"use client";

import type { SessionState } from "@/lib/engine/types";
import { getWord, wordLabel } from "@/lib/engine/words";
import { StatusBadge } from "./LessonPanel";

export function RecapCard({ lesson }: { lesson: SessionState }) {
  if (!lesson.results.length) return null;
  const used = lesson.results.filter((r) => r.status === "correct" || r.status === "assisted").length;

  return (
    <section className="flex flex-col gap-4 rounded-3xl border border-border bg-surface p-5" aria-label="Session recap">
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-accent">Session recap</p>
        <h2 className="text-xl font-semibold tracking-tight">
          You used {used} of {lesson.results.length} {lesson.results.length === 1 ? "word" : "words"} yourself
        </h2>
      </div>
      <ul className="flex flex-col divide-y divide-border">
        {lesson.results.map((r) => {
          const w = getWord(r.wordId);
          if (!w) return null;
          return (
            <li key={r.wordId} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg font-semibold">{wordLabel(w)}</span>
                <StatusBadge status={r.status} />
                {r.hintLevel > 0 && r.hintLevel < 4 && (
                  <span className="text-xs text-muted">
                    {r.hintLevel} {r.hintLevel === 1 ? "hint" : "hints"}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted">{w.definition}</p>
              {r.bestSentence ? (
                <p className="text-sm">
                  <span className="text-muted">Your sentence: </span>“{r.bestSentence}”
                </p>
              ) : (
                <p className="text-sm">
                  <span className="text-muted">Example: </span>“{w.example}”
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
