"use client";

import type { SessionState, WordStatus } from "@/lib/engine/types";
import { getWord, wordLabel } from "@/lib/engine/words";

const STATUS_STYLE: Record<WordStatus, { label: string; className: string }> = {
  correct: { label: "Used it", className: "bg-ok-bg text-ok-text" },
  assisted: { label: "With help", className: "bg-accent-soft text-accent" },
  revealed: { label: "Revealed", className: "bg-warn-bg text-warn-text" },
  skipped: { label: "Skipped", className: "bg-surface-2 text-muted" },
};

const HINT_LABELS = ["No hints yet", "Meaning hint", "Sound hint", "Comparison hint", "Word revealed"];

export function StatusBadge({ status }: { status: WordStatus }) {
  const s = STATUS_STYLE[status];
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${s.className}`}>{s.label}</span>;
}

export function LessonPanel({
  lesson,
  busy,
  onHint,
  onSkip,
}: {
  lesson: SessionState;
  busy: boolean;
  onHint: () => void;
  onSkip: () => void;
}) {
  if (lesson.stage === "onboarding") {
    return (
      <section className="rounded-3xl border border-border bg-surface p-5 text-sm text-muted">
        Tell Lexi what you want better words for (<b className="text-text">work</b>, <b className="text-text">exams</b>, or{" "}
        <b className="text-text">everyday</b> conversation) and she&apos;ll pick 3 words for you.
      </section>
    );
  }
  if (lesson.stage !== "mission" || !lesson.current) return null;

  const word = getWord(lesson.current.wordId)!;
  const { hintLevel } = lesson.current;
  const revealed = hintLevel >= 4;
  const unlockedHints = [word.hints.meaning, word.hints.sound, word.hints.contrast].slice(0, Math.min(hintLevel, 3));

  return (
    <section className="flex flex-col gap-4 rounded-3xl border border-border bg-surface p-5" aria-label="Current word">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-widest text-muted">
          Word {lesson.index + 1} of {lesson.queue.length}
        </p>
        <ol className="flex gap-1.5" aria-label="Session progress">
          {lesson.queue.map((id, i) => {
            const result = lesson.results.find((r) => r.wordId === id);
            const state = result ? (result.status === "skipped" ? "bg-border" : "bg-accent") : i === lesson.index ? "bg-accent/50" : "bg-surface-2";
            return <li key={id} className={`h-1.5 w-8 rounded-full ${state}`} />;
          })}
        </ol>
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-2xl font-semibold tracking-tight">
          {revealed ? wordLabel(word) : <span className="text-muted">Say it yourself</span>}
          <span className="ml-2 align-middle text-sm font-normal text-muted">{word.pos}</span>
        </p>
        <p className="text-[15px] leading-relaxed">{word.definition}</p>
        {!revealed && (
          <p className="text-xs text-muted">The word stays hidden so you have to recall it. Use it in your answer.</p>
        )}
      </div>

      {unlockedHints.length > 0 && (
        <ul className="flex flex-col gap-1.5 text-sm">
          {unlockedHints.map((h) => (
            <li key={h} className="rounded-xl bg-surface-2 px-3 py-2">
              💡 {h}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2" aria-label={`Hints used: ${HINT_LABELS[hintLevel]}`}>
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((n) => (
              <span key={n} className={`h-2 w-4 rounded-sm ${n <= hintLevel ? "bg-warn-text/70" : "bg-surface-2"}`} />
            ))}
          </div>
          <span className="text-xs text-muted">{HINT_LABELS[hintLevel]}</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onHint}
            disabled={busy || revealed}
            className="rounded-full border border-border px-4 py-2 text-sm font-medium transition hover:bg-surface-2 disabled:opacity-40"
          >
            Hint
          </button>
          <button
            onClick={onSkip}
            disabled={busy}
            className="rounded-full border border-border px-4 py-2 text-sm font-medium text-muted transition hover:bg-surface-2 hover:text-text disabled:opacity-40"
          >
            Skip word
          </button>
        </div>
      </div>
    </section>
  );
}
