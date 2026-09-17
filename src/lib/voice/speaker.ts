import { chunkText, toSpeakable } from "./sentences";

export type VoiceEngine = "browser" | "groq";
export const GROQ_VOICES = ["diana", "hannah", "autumn", "austin", "daniel", "troy"] as const;
export type GroqVoice = (typeof GROQ_VOICES)[number];

type Item = { text: string; audio?: Promise<Blob | null> };

type SpeakerCallbacks = {
  /** First audio of the current response started playing. */
  onStart?: () => void;
  /** Queue drained after `finish()` was called. */
  onDone?: () => void;
  /** HD voice failed (e.g. free-tier limit) and the browser voice took over. */
  onFallback?: (reason: string) => void;
};

const ORPHEUS_MAX_CHARS = 200;

/**
 * Sequential speech output. Sentences are queued as the LLM streams; HD audio is
 * fetched ahead so playback is gapless, and anything that fails is spoken by the
 * browser's built-in voice instead.
 */
export class Speaker {
  engine: VoiceEngine = "browser";
  groqVoice: GroqVoice = "diana";
  callbacks: SpeakerCallbacks = {};

  private queue: Item[] = [];
  private generation = 0;
  private playing = false;
  private finished = false;
  private startedThisResponse = false;
  private hdDisabled = false;
  private audioEl: HTMLAudioElement | null = null;
  private browserVoice: SpeechSynthesisVoice | null = null;

  /** Must be called inside a user gesture (tap/click) so iOS allows audio later. */
  unlock() {
    if (typeof window === "undefined") return;
    this.audioEl ??= new Audio();
    this.audioEl.muted = true;
    this.audioEl.src =
      "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=";
    this.audioEl.play().catch(() => {}).finally(() => {
      if (this.audioEl) this.audioEl.muted = false;
    });
    if ("speechSynthesis" in window) {
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      window.speechSynthesis.speak(u);
      this.pickBrowserVoice();
      window.speechSynthesis.onvoiceschanged = () => this.pickBrowserVoice();
    }
  }

  get isActive() {
    return this.playing || this.queue.length > 0;
  }

  /** Starts a new response. */
  begin() {
    this.stop();
    this.finished = false;
    this.startedThisResponse = false;
  }

  enqueue(sentence: string) {
    const text = toSpeakable(sentence);
    if (!text) return;
    const useHd = this.engine === "groq" && !this.hdDisabled;
    const parts = useHd ? chunkText(text, ORPHEUS_MAX_CHARS) : [text];
    for (const part of parts) {
      this.queue.push({ text: part, audio: useHd ? this.fetchHd(part) : undefined });
    }
    void this.pump();
  }

  /** No more sentences are coming for this response. */
  finish() {
    this.finished = true;
    if (!this.isActive) this.callbacks.onDone?.();
  }

  stop() {
    this.generation++;
    this.queue = [];
    this.playing = false;
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl.removeAttribute("src");
    }
  }

  private async pump() {
    if (this.playing) return;
    this.playing = true;
    const gen = this.generation;
    while (this.queue.length && gen === this.generation) {
      const item = this.queue.shift()!;
      const blob = item.audio ? await item.audio : null;
      if (gen !== this.generation) return;
      if (!this.startedThisResponse) {
        this.startedThisResponse = true;
        this.callbacks.onStart?.();
      }
      if (blob) await this.playBlob(blob);
      else await this.speakBrowser(item.text);
    }
    if (gen !== this.generation) return;
    this.playing = false;
    if (this.finished) this.callbacks.onDone?.();
  }

  private async fetchHd(text: string): Promise<Blob | null> {
    try {
      const res = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice: this.groqVoice }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const reason =
          res.status === 429
            ? "HD voice limit reached (Groq free tier)"
            : /terms/i.test(body.message ?? "")
              ? "HD voice needs its terms accepted once in the Groq console (Playground → Orpheus)"
              : "HD voice unavailable";
        if (!this.hdDisabled) {
          this.hdDisabled = true;
          this.callbacks.onFallback?.(reason);
        }
        return null;
      }
      return await res.blob();
    } catch {
      return null;
    }
  }

  private playBlob(blob: Blob): Promise<void> {
    return new Promise((resolve) => {
      this.audioEl ??= new Audio();
      const el = this.audioEl;
      const url = URL.createObjectURL(blob);
      const done = () => {
        el.onended = el.onerror = el.onpause = null;
        URL.revokeObjectURL(url);
        resolve();
      };
      el.onended = done;
      el.onerror = done;
      el.onpause = done; // stop() pauses the element
      el.src = url;
      el.play().catch(done);
    });
  }

  private speakBrowser(text: string): Promise<void> {
    return new Promise((resolve) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return resolve();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "en-US";
      u.rate = 0.95;
      if (this.browserVoice) u.voice = this.browserVoice;
      // Some browsers occasionally never fire `end`; don't let the queue hang.
      const safety = setTimeout(finish, 4000 + text.length * 110);
      function finish() {
        clearTimeout(safety);
        resolve();
      }
      u.onend = finish;
      u.onerror = finish;
      window.speechSynthesis.speak(u);
    });
  }

  private pickBrowserVoice() {
    const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en"));
    const preferred = [/natural/i, /google us english/i, /samantha/i, /aria/i, /jenny/i, /google uk english female/i];
    this.browserVoice =
      preferred.map((re) => voices.find((v) => re.test(v.name))).find(Boolean) ??
      voices.find((v) => v.lang === "en-US") ??
      voices[0] ??
      null;
  }
}
