"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MicVAD } from "@ricky0123/vad-web";
import { BrowserStt, browserSttSupported } from "./browserStt";
import { GREETING_TEXT } from "./greeting";
import { SentenceSplitter } from "./sentences";
import { Speaker, type GroqVoice, type VoiceEngine } from "./speaker";
import { HOLD_REQUEST_MAX_MS, PATIENCE, decideTurn, joinSegments, stripLeadingHolds, type Patience } from "./turnTaking";
import { encodeWav } from "./wav";

export type Status =
  | "idle"
  | "loading"
  | "listening" // waiting for the learner
  | "hearing" // learner is speaking
  | "holding" // learner paused mid-thought; waiting longer
  | "thinking" // waiting for the coach's reply
  | "speaking" // coach is talking
  | "ended"
  | "error";

export type Turn = {
  id: number;
  role: "user" | "assistant";
  text: string;
  streaming?: boolean;
  interrupted?: boolean;
  typed?: boolean;
};

export type Settings = {
  patience: Patience;
  voice: VoiceEngine;
  groqVoice: GroqVoice;
  /** With headphones the mic stays open while the coach talks, so you can interrupt by voice. */
  headphones: boolean;
};

export type Metrics = {
  /** ms from the moment the reply was requested to the first coach audio. */
  responseMs: number[];
  /** ms from the learner's last speech to the first coach audio (includes patience wait). */
  endToEndMs: number[];
};

type Inflight = {
  controller: AbortController;
  userTurnId: number;
  userText: string;
  assistantTurnId: number;
  requestedAt: number;
  speechEndedAt: number | null;
  audioStarted: boolean;
};

const SESSION_CAP_MS = 10 * 60 * 1000;
const HISTORY_LIMIT = 20;

export type SttEngine = "groq" | "browser";

export function useVoiceCoach(settings: Settings, opts: { groqStt: boolean }) {
  const [status, setStatus] = useState<Status>("idle");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState(""); // learner speech heard but not yet sent
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [micAvailable, setMicAvailable] = useState(true);
  const [sttEngine, setSttEngine] = useState<SttEngine>("groq");
  const [metrics, setMetrics] = useState<Metrics>({ responseMs: [], endToEndMs: [] });

  const settingsRef = useRef(settings);
  const turnsRef = useRef<Turn[]>([]);
  const statusRef = useRef<Status>("idle");
  const nextId = useRef(1);
  const vadRef = useRef<MicVAD | null>(null);
  const speakerRef = useRef<Speaker | null>(null);
  const levelRef = useRef(0);
  const micAvailableRef = useRef(true);
  const sttEngineRef = useRef<SttEngine>("groq");
  const browserSttRef = useRef<BrowserStt | null>(null);
  const groqSttRef = useRef(opts.groqStt);
  useEffect(() => {
    groqSttRef.current = opts.groqStt;
  }, [opts.groqStt]);

  // Pending learner turn
  const segments = useRef<Promise<string>[]>([]);
  const extended = useRef(false);
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const turnGeneration = useRef(0);
  const lastSpeechEndAt = useRef<number | null>(null);

  const inflight = useRef<Inflight | null>(null);
  const capTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    settingsRef.current = settings;
    const speaker = speakerRef.current;
    if (speaker) {
      speaker.engine = settings.voice;
      speaker.groqVoice = settings.groqVoice;
    }
  }, [settings]);

  const setStatusBoth = useCallback((s: Status) => {
    statusRef.current = s;
    setStatus(s);
  }, []);

  const updateTurns = useCallback((fn: (t: Turn[]) => Turn[]) => {
    turnsRef.current = fn(turnsRef.current);
    setTurns(turnsRef.current);
  }, []);

  const addTurn = useCallback(
    (turn: Omit<Turn, "id">) => {
      const id = nextId.current++;
      updateTurns((t) => [...t, { ...turn, id }]);
      return id;
    },
    [updateTurns],
  );

  const patchTurn = useCallback(
    (id: number, patch: Partial<Turn>) => updateTurns((t) => t.map((x) => (x.id === id ? { ...x, ...patch } : x))),
    [updateTurns],
  );

  const clearCommitTimer = () => {
    if (commitTimer.current) clearTimeout(commitTimer.current);
    commitTimer.current = null;
  };

  const resetPendingTurn = useCallback(() => {
    clearCommitTimer();
    segments.current = [];
    extended.current = false;
    setDraft("");
  }, []);

  const micOpen = useCallback(async (open: boolean) => {
    const vad = vadRef.current;
    if (!vad) return;
    if (sttEngineRef.current === "browser") {
      if (open) browserSttRef.current?.start();
      else browserSttRef.current?.stop();
    }
    if (open && !vad.listening) await vad.start();
    if (!open && vad.listening) await vad.pause();
  }, []);

  /** Switches speech-to-text to the browser's recognizer (Groq Whisper unavailable). */
  const switchToBrowserStt = useCallback(() => {
    if (sttEngineRef.current === "browser") return true;
    if (!browserSttSupported()) return false;
    sttEngineRef.current = "browser";
    setSttEngine("browser");
    const stt = new BrowserStt();
    stt.onError = (message) => setNotice(message);
    browserSttRef.current = stt;
    if (vadRef.current?.listening) stt.start();
    return true;
  }, []);

  /** Stops the coach mid-reply. Returns text the learner said that should be re-used. */
  const interrupt = useCallback(
    (reason: "barge_in" | "button" | "typed") => {
      const f = inflight.current;
      if (!f) {
        speakerRef.current?.stop();
        return "";
      }
      inflight.current = null;
      f.controller.abort();
      speakerRef.current?.stop();

      if (!f.audioStarted && reason === "barge_in" && f.userTurnId !== -1) {
        // The coach hadn't started talking: treat the learner's new speech as a continuation.
        updateTurns((t) => t.filter((x) => x.id !== f.userTurnId && x.id !== f.assistantTurnId));
        return f.userText;
      }
      const assistant = turnsRef.current.find((x) => x.id === f.assistantTurnId);
      if (assistant && !assistant.text.trim()) {
        updateTurns((t) => t.filter((x) => x.id !== f.assistantTurnId));
      } else {
        patchTurn(f.assistantTurnId, { streaming: false, interrupted: true });
      }
      return "";
    },
    [patchTurn, updateTurns],
  );

  const afterCoachDone = useCallback(async () => {
    if (statusRef.current === "ended" || statusRef.current === "error") return;
    setStatusBoth("listening");
    if (micAvailableRef.current) await micOpen(true);
  }, [micOpen, setStatusBoth]);

  /** Sends the learner's message and streams + speaks the coach's reply. */
  const respond = useCallback(
    async (userText: string, opts: { typed?: boolean } = {}) => {
      const speaker = speakerRef.current!;
      const userTurnId = addTurn({ role: "user", text: userText, typed: opts.typed });
      const history = turnsRef.current
        .filter((t) => t.text.trim())
        .slice(-HISTORY_LIMIT)
        .map((t) => ({ role: t.role, content: t.interrupted ? `${t.text} [interrupted]` : t.text }));
      const assistantTurnId = addTurn({ role: "assistant", text: "", streaming: true });

      const f: Inflight = {
        controller: new AbortController(),
        userTurnId,
        userText,
        assistantTurnId,
        requestedAt: performance.now(),
        speechEndedAt: opts.typed ? null : lastSpeechEndAt.current,
        audioStarted: false,
      };
      inflight.current = f;
      setStatusBoth("thinking");

      speaker.begin();
      speaker.callbacks = {
        onStart: () => {
          if (inflight.current !== f) return;
          f.audioStarted = true;
          const now = performance.now();
          setMetrics((m) => ({
            responseMs: [...m.responseMs, now - f.requestedAt],
            endToEndMs: f.speechEndedAt ? [...m.endToEndMs, now - f.speechEndedAt] : m.endToEndMs,
          }));
          setStatusBoth("speaking");
          // On speakers, close the mic so the coach doesn't hear (and interrupt) itself.
          if (!settingsRef.current.headphones) void micOpen(false);
        },
        onDone: () => {
          if (inflight.current !== f) return;
          inflight.current = null;
          void afterCoachDone();
        },
        onFallback: (reason) => setNotice(`${reason}. Using your browser's voice instead.`),
      };

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history }),
          signal: f.controller.signal,
        });
        if (!res.ok || !res.body) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            res.status === 429
              ? "The coach is getting too many requests (Groq free-tier limit). Wait a minute and try again."
              : body.message ?? "The coach is unavailable right now.",
          );
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        const splitter = new SentenceSplitter();
        let text = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          if (inflight.current !== f) return;
          const delta = decoder.decode(value, { stream: true });
          text += delta;
          patchTurn(assistantTurnId, { text });
          for (const sentence of splitter.push(delta)) speaker.enqueue(sentence);
        }
        if (inflight.current !== f) return;
        const rest = splitter.flush();
        if (rest) speaker.enqueue(rest);
        patchTurn(assistantTurnId, { text: text.trim(), streaming: false });
        if (!text.trim()) {
          updateTurns((t) => t.filter((x) => x.id !== assistantTurnId));
        }
        speaker.finish();
      } catch (err) {
        if (f.controller.signal.aborted) return;
        inflight.current = null;
        updateTurns((t) => t.filter((x) => x.id !== assistantTurnId));
        setNotice(err instanceof Error ? err.message : "Something went wrong.");
        void afterCoachDone();
      }
    },
    [addTurn, afterCoachDone, micOpen, patchTurn, setStatusBoth, updateTurns],
  );

  /** Decides whether the learner's pause ends their turn. */
  const evaluateTurn = useCallback(async () => {
    const generation = turnGeneration.current;
    const texts = await Promise.all(segments.current);
    if (generation !== turnGeneration.current) return; // learner started speaking again
    const text = joinSegments(texts);
    const decision = decideTurn(text, extended.current);

    if (decision === "empty") {
      resetPendingTurn();
      if (statusRef.current === "hearing" || statusRef.current === "holding") setStatusBoth("listening");
      return;
    }
    if (decision === "hold_request" || decision === "extend") {
      extended.current = true;
      setStatusBoth("holding");
      const wait = decision === "hold_request" ? HOLD_REQUEST_MAX_MS : PATIENCE[settingsRef.current.patience].holdMs;
      commitTimer.current = setTimeout(() => {
        commitTimer.current = null;
        void evaluateTurn();
      }, wait);
      return;
    }
    resetPendingTurn();
    void respond(stripLeadingHolds(text));
  }, [resetPendingTurn, respond, setStatusBoth]);

  const transcribe = useCallback(async (audio: Float32Array): Promise<string> => {
    const form = new FormData();
    form.append("audio", encodeWav(audio), "speech.wav");
    try {
      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) {
        setNotice(
          res.status === 429
            ? "Speech recognition limit reached for this minute. Please wait a moment."
            : body.error === "setup_required"
              ? switchToBrowserStt()
                ? "Groq speech recognition isn't enabled for this key, so your browser's speech recognition is used instead. Please say that again."
                : `${body.message} Until then, type your answers below.`
              : "Couldn't transcribe that. Please try again.",
        );
        return "";
      }
      return body.text ?? "";
    } catch {
      setNotice("Network problem while sending your speech. Please try again.");
      return "";
    }
  }, [switchToBrowserStt]);

  const onSpeechStart = useCallback(() => {
    turnGeneration.current++;
    clearCommitTimer();
  }, []);

  const onSpeechRealStart = useCallback(() => {
    if (statusRef.current === "ended") return;
    if (inflight.current) {
      const carried = interrupt("barge_in");
      if (carried) {
        segments.current = [Promise.resolve(carried), ...segments.current];
        setDraft((d) => (d ? `${carried} ${d}` : carried));
      }
    }
    setStatusBoth("hearing");
  }, [interrupt, setStatusBoth]);

  const onSpeechEnd = useCallback(
    (audio: Float32Array) => {
      if (statusRef.current === "ended") return;
      lastSpeechEndAt.current = performance.now();
      const words = sttEngineRef.current === "browser" && browserSttRef.current
        ? browserSttRef.current.take()
        : transcribe(audio);
      const pending = words.then((text) => {
        if (text) setDraft((d) => joinSegments([d, text]));
        return text;
      });
      segments.current.push(pending);
      clearCommitTimer();
      commitTimer.current = setTimeout(() => {
        commitTimer.current = null;
        void evaluateTurn();
      }, PATIENCE[settingsRef.current.patience].commitMs);
    },
    [evaluateTurn, transcribe],
  );

  const onMisfire = useCallback(() => {
    if (statusRef.current === "hearing") setStatusBoth(segments.current.length ? "holding" : "listening");
    if (segments.current.length && !commitTimer.current) {
      commitTimer.current = setTimeout(() => {
        commitTimer.current = null;
        void evaluateTurn();
      }, PATIENCE[settingsRef.current.patience].commitMs);
    }
  }, [evaluateTurn, setStatusBoth]);

  // Keep VAD callbacks pointing at the latest closures without recreating the mic.
  const handlers = useRef({ onSpeechStart, onSpeechRealStart, onSpeechEnd, onMisfire });
  useEffect(() => {
    handlers.current = { onSpeechStart, onSpeechRealStart, onSpeechEnd, onMisfire };
  }, [onSpeechStart, onSpeechRealStart, onSpeechEnd, onMisfire]);

  const end = useCallback(async () => {
    if (capTimer.current) clearTimeout(capTimer.current);
    interrupt("button");
    resetPendingTurn();
    setStatusBoth("ended");
    browserSttRef.current?.stop();
    const vad = vadRef.current;
    vadRef.current = null;
    await vad?.destroy().catch(() => {});
  }, [interrupt, resetPendingTurn, setStatusBoth]);

  const start = useCallback(async () => {
    setError(null);
    setNotice(null);
    setStatusBoth("loading");

    // Audio must be unlocked inside the tap that started the session (iOS).
    const speaker = speakerRef.current ?? new Speaker();
    speakerRef.current = speaker;
    speaker.engine = settingsRef.current.voice;
    speaker.groqVoice = settingsRef.current.groqVoice;
    speaker.unlock();

    turnsRef.current = [];
    setTurns([]);
    setMetrics({ responseMs: [], endToEndMs: [] });
    resetPendingTurn();

    let micOk = true;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("unsupported");
      const { MicVAD } = await import("@ricky0123/vad-web");
      vadRef.current = await MicVAD.new({
        model: "v5",
        baseAssetPath: "/vad/",
        onnxWASMBasePath: "/vad/",
        startOnLoad: false,
        positiveSpeechThreshold: 0.5,
        negativeSpeechThreshold: 0.35,
        redemptionMs: 600,
        minSpeechMs: 250,
        preSpeechPadMs: 300,
        ortConfig: (ort) => {
          ort.env.wasm.numThreads = 1;
        },
        onFrameProcessed: (probs) => {
          levelRef.current = probs.isSpeech;
        },
        onSpeechStart: () => handlers.current.onSpeechStart(),
        onSpeechRealStart: () => handlers.current.onSpeechRealStart(),
        onSpeechEnd: (audio) => handlers.current.onSpeechEnd(audio),
        onVADMisfire: () => handlers.current.onMisfire(),
      });
    } catch (err) {
      micOk = false;
      const name = err instanceof Error ? err.name : "";
      setNotice(
        name === "NotAllowedError"
          ? "Microphone access was blocked. Allow it in your browser's site settings, or type your answers below."
          : name === "NotFoundError"
            ? "No microphone found. You can type your answers below."
            : "Voice input isn't available in this browser. You can type your answers below.",
      );
      console.warn("[voice] mic unavailable", err);
    }
    micAvailableRef.current = micOk;
    setMicAvailable(micOk);
    if (micOk && !groqSttRef.current && !switchToBrowserStt()) {
      setNotice("Speech recognition isn't available (Groq Whisper is blocked and this browser has no built-in recognizer). Please type your answers, or try Chrome.");
    }

    capTimer.current = setTimeout(() => {
      setNotice("Session time limit reached (10 minutes). Start again whenever you're ready!");
      void end();
    }, SESSION_CAP_MS);

    // Instant scripted greeting: no LLM round-trip needed.
    const greetingId = addTurn({ role: "assistant", text: GREETING_TEXT });
    const f: Inflight = {
      controller: new AbortController(),
      userTurnId: -1,
      userText: "",
      assistantTurnId: greetingId,
      requestedAt: performance.now(),
      speechEndedAt: null,
      audioStarted: false,
    };
    inflight.current = f;
    speaker.begin();
    speaker.callbacks = {
      onStart: () => {
        f.audioStarted = true;
        setStatusBoth("speaking");
        if (!settingsRef.current.headphones) void micOpen(false);
      },
      onDone: () => {
        if (inflight.current !== f) return;
        inflight.current = null;
        void afterCoachDone();
      },
      onFallback: (reason) => setNotice(`${reason}. Using your browser's voice instead.`),
    };
    if (settingsRef.current.headphones && micOk) await micOpen(true);
    speaker.enqueue(GREETING_TEXT);
    speaker.finish();
  }, [addTurn, afterCoachDone, end, micOpen, resetPendingTurn, setStatusBoth, switchToBrowserStt]);

  const sendText = useCallback(
    (text: string) => {
      const t = text.trim();
      if (!t || statusRef.current === "ended" || statusRef.current === "idle") return;
      if (inflight.current) interrupt("typed");
      resetPendingTurn();
      void respond(t, { typed: true });
    },
    [interrupt, resetPendingTurn, respond],
  );

  const stopCoach = useCallback(() => {
    if (!inflight.current) return;
    interrupt("button");
    void afterCoachDone();
  }, [afterCoachDone, interrupt]);

  // Headphone mode can change mid-session.
  useEffect(() => {
    if (statusRef.current === "speaking") void micOpen(settings.headphones && micAvailableRef.current);
  }, [settings.headphones, micOpen]);

  useEffect(
    () => () => {
      if (capTimer.current) clearTimeout(capTimer.current);
      clearCommitTimer();
      speakerRef.current?.stop();
      browserSttRef.current?.stop();
      void vadRef.current?.destroy();
    },
    [],
  );

  return {
    status,
    turns,
    draft,
    notice,
    error,
    micAvailable,
    sttEngine,
    metrics,
    levelRef,
    start,
    end,
    sendText,
    stopCoach,
    dismissNotice: () => setNotice(null),
    setError,
  };
}
