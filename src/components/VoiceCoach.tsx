"use client";

import { useEffect, useState, type FormEvent } from "react";
import { LessonPanel } from "./LessonPanel";
import { RecapCard } from "./RecapCard";
import { StatusOrb } from "./StatusOrb";
import { Transcript } from "./Transcript";
import type { Level } from "@/lib/engine/types";
import { GROQ_VOICES, type GroqVoice } from "@/lib/voice/speaker";
import { PATIENCE, type Patience } from "@/lib/voice/turnTaking";
import { useVoiceCoach, type Metrics, type Settings, type TurnLog } from "@/lib/voice/useVoiceCoach";

const SETTINGS_KEY = "lexi.settings.v1";
const DEFAULT_SETTINGS: Settings = {
  level: "upper_intermediate",
  patience: "balanced",
  voice: "browser",
  groqVoice: "diana",
  headphones: false,
};

const LEVEL_OPTIONS: { value: Level; label: string }[] = [
  { value: "intermediate", label: "Intermediate" },
  { value: "upper_intermediate", label: "Upper-intermediate" },
  { value: "advanced", label: "Advanced" },
];

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function VoiceCoach() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [groqStt, setGroqStt] = useState(true);
  const [typed, setTyped] = useState("");
  const coach = useVoiceCoach(settings, { groqStt });

  useEffect(() => {
    // Reading localStorage must happen after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings(loadSettings());
    fetch("/api/health")
      .then((r) => r.json())
      .then((b) => {
        setConfigured(Boolean(b.groqConfigured));
        setGroqStt(b.groqStt !== false);
      })
      .catch(() => setConfigured(false));
  }, []);

  const update = (patch: Partial<Settings>) => {
    setSettings((s) => {
      const next = { ...s, ...patch };
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable: settings just won't persist */
      }
      return next;
    });
  };

  const active = !["idle", "ended", "error"].includes(coach.status);
  const coachBusy = coach.status === "thinking" || coach.status === "speaking";

  const submitTyped = (e: FormEvent) => {
    e.preventDefault();
    coach.sendText(typed);
    setTyped("");
  };

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-6 sm:py-10">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-medium uppercase tracking-widest text-accent">Lexi · voice vocabulary coach</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Don&apos;t just learn words. Use them.</h1>
        <p className="text-sm text-muted">
          Lexi teaches you 3 words, then gives you a quick speaking challenge for each one. The word stays hidden, so you
          have to recall it and use it in your own sentence. Stuck? You get hints, not answers.
        </p>
      </header>

      {configured === false && (
        <div role="alert" className="rounded-xl bg-warn-bg px-4 py-3 text-sm text-warn-text">
          The server has no <code className="font-mono">GROQ_API_KEY</code>. Add it to{" "}
          <code className="font-mono">.env.local</code> (or your hosting env vars) and restart.
        </div>
      )}

      <section className="flex flex-col items-center gap-5 rounded-3xl border border-border bg-surface px-4 py-8">
        <StatusOrb status={coach.status} levelRef={coach.levelRef} />

        {!active && (
          <fieldset className="flex flex-col items-center gap-2">
            <legend className="sr-only">Your level</legend>
            <Segmented value={settings.level} options={LEVEL_OPTIONS} onChange={(v) => update({ level: v })} />
          </fieldset>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3">
          {!active ? (
            <button
              onClick={() => void coach.start()}
              disabled={configured === false}
              className="rounded-full bg-accent px-7 py-3 text-base font-medium text-accent-text transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40"
            >
              {coach.status === "ended" ? "Start again" : "Start talking"}
            </button>
          ) : (
            <>
              {coachBusy && (
                <button
                  onClick={coach.stopCoach}
                  className="rounded-full border border-border bg-surface-2 px-5 py-2.5 text-sm font-medium transition hover:opacity-80 focus-visible:outline-2 focus-visible:outline-accent"
                >
                  Interrupt
                </button>
              )}
              <button
                onClick={() => void coach.end()}
                className="rounded-full border border-border px-5 py-2.5 text-sm font-medium text-muted transition hover:text-text focus-visible:outline-2 focus-visible:outline-accent"
              >
                End session
              </button>
            </>
          )}
        </div>

        {!active && coach.status === "idle" && (
          <p className="max-w-sm text-center text-xs text-muted">
            {groqStt
              ? "Your voice is sent to Groq for speech recognition."
              : "Speech recognition uses your browser's built-in service (Chrome, Edge, or Safari)."}{" "}
            Nothing is stored. Headphones work best.
          </p>
        )}
      </section>

      {coach.notice && (
        <div role="status" className="flex items-start justify-between gap-3 rounded-xl bg-warn-bg px-4 py-3 text-sm text-warn-text">
          <span>{coach.notice}</span>
          <button onClick={coach.dismissNotice} className="shrink-0 font-medium underline" aria-label="Dismiss notice">
            Dismiss
          </button>
        </div>
      )}

      {active && coach.lesson && (
        <LessonPanel
          lesson={coach.lesson}
          busy={coach.status === "thinking"}
          onHint={() => coach.sendAction("hint")}
          onSkip={() => coach.sendAction("skip")}
        />
      )}
      {coach.status === "ended" && coach.lesson && <RecapCard lesson={coach.lesson} />}

      <section className="flex min-h-48 flex-col gap-3 rounded-3xl border border-border bg-surface p-4">
        <Transcript turns={coach.turns} draft={coach.draft} />
        {active && (
          <form onSubmit={submitTyped} className="mt-2 flex gap-2">
            <label htmlFor="typed" className="sr-only">
              Type your answer
            </label>
            <input
              id="typed"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={coach.micAvailable ? "Or type instead…" : "Type your answer…"}
              maxLength={500}
              className="min-w-0 flex-1 rounded-full border border-border bg-bg px-4 py-2.5 text-sm outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={!typed.trim()}
              className="rounded-full bg-accent px-4 py-2.5 text-sm font-medium text-accent-text disabled:opacity-40"
            >
              Send
            </button>
          </form>
        )}
      </section>

      <SettingsPanel settings={settings} onChange={update} />
      <MetricsPanel metrics={coach.metrics} sttEngine={coach.sttEngine} log={coach.log} />
    </main>
  );
}

function SettingsPanel({ settings, onChange }: { settings: Settings; onChange: (p: Partial<Settings>) => void }) {
  return (
    <details className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm">
      <summary className="cursor-pointer font-medium">Settings</summary>
      <div className="mt-4 flex flex-col gap-5">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-muted">How long Lexi waits when you pause</legend>
          <Segmented
            value={settings.patience}
            options={(Object.keys(PATIENCE) as Patience[]).map((k) => ({ value: k, label: PATIENCE[k].label }))}
            onChange={(v) => onChange({ patience: v })}
          />
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-muted">Coach voice</legend>
          <Segmented
            value={settings.voice}
            options={[
              { value: "browser", label: "Browser (unlimited)" },
              { value: "groq", label: "HD (Groq, limited)" },
            ]}
            onChange={(v) => onChange({ voice: v })}
          />
          {settings.voice === "groq" && (
            <select
              value={settings.groqVoice}
              onChange={(e) => onChange({ groqVoice: e.target.value as GroqVoice })}
              className="w-fit rounded-lg border border-border bg-bg px-3 py-2 capitalize"
              aria-label="HD voice"
            >
              {GROQ_VOICES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          )}
          <p className="text-xs text-muted">
            Groq&apos;s free tier allows about 100 HD voice clips a day; Lexi switches to the browser voice when the limit is hit.
          </p>
        </fieldset>

        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={settings.headphones}
            onChange={(e) => onChange({ headphones: e.target.checked })}
            className="mt-0.5 size-4 accent-[var(--accent)]"
          />
          <span>
            I&apos;m wearing headphones
            <span className="block text-xs text-muted">
              Keeps the mic on while Lexi talks, so you can interrupt by speaking. On speakers, use the Interrupt button.
            </span>
          </span>
        </label>
      </div>
    </details>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex w-fit flex-wrap gap-1 rounded-full bg-surface-2 p-1" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-full px-3 py-1.5 transition ${
            value === o.value ? "bg-surface font-medium shadow-sm" : "text-muted hover:text-text"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function median(xs: number[]) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function downloadLog(log: TurnLog[]) {
  const blob = new Blob([JSON.stringify(log, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `lexi-session-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function MetricsPanel({ metrics, sttEngine, log }: { metrics: Metrics; sttEngine: "groq" | "browser"; log: TurnLog[] }) {
  const fmt = (ms: number | null) => (ms === null ? "–" : `${(ms / 1000).toFixed(2)}s`);
  const last = (xs: number[]) => (xs.length ? xs[xs.length - 1] : null);
  return (
    <details className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm">
      <summary className="cursor-pointer font-medium">Testing tools</summary>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-xs sm:grid-cols-4">
        <div>
          <dt className="text-muted">Reply → voice (last)</dt>
          <dd>{fmt(last(metrics.responseMs))}</dd>
        </div>
        <div>
          <dt className="text-muted">Reply → voice (median)</dt>
          <dd>{fmt(median(metrics.responseMs))}</dd>
        </div>
        <div>
          <dt className="text-muted">You stop → voice (median)</dt>
          <dd>{fmt(median(metrics.endToEndMs))}</dd>
        </div>
        <div>
          <dt className="text-muted">Replies</dt>
          <dd>{metrics.responseMs.length}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-muted">Speech recognition</dt>
          <dd>{sttEngine === "groq" ? "Groq Whisper" : "Browser (Web Speech API)"}</dd>
        </div>
        <div>
          <dt className="text-muted">Judge (median)</dt>
          <dd>{fmt(median(log.map((l) => l.judgeMs).filter((ms) => ms > 0)))}</dd>
        </div>
        <div>
          <dt className="text-muted">Word redactions</dt>
          <dd>{log.reduce((n, l) => n + (l.redactions ?? 0), 0)}</dd>
        </div>
      </dl>
      <button
        onClick={() => downloadLog(log)}
        disabled={!log.length}
        className="mt-3 rounded-full border border-border px-4 py-2 text-xs font-medium disabled:opacity-40"
      >
        Download session log ({log.length} turns)
      </button>
    </details>
  );
}
