"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type { Verdict } from "@/lib/engine/types";
import type { Turn } from "@/lib/voice/useVoiceCoach";

const VERDICT_CHIP: Partial<Record<Verdict, { label: string; className: string }>> = {
  correct: { label: "✓ Used correctly", className: "bg-ok-bg text-ok-text" },
  retry: { label: "↻ Not quite, try again", className: "bg-warn-bg text-warn-text" },
  revealed_retry: { label: "↻ Word revealed, try again", className: "bg-warn-bg text-warn-text" },
  move_on: { label: "→ Moving on", className: "bg-surface-2 text-muted" },
};

/** Highlights the matched form of the target word in what the learner said. */
function highlight(text: string, form: string | null | undefined): ReactNode {
  if (!form) return text;
  const pattern = form.trim().split(/\s+/).map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[\\s-]+");
  const match = new RegExp(`\\b${pattern}\\b`, "i").exec(text);
  if (!match) return text;
  return (
    <>
      {text.slice(0, match.index)}
      <mark className="rounded bg-accent-soft px-0.5 text-text">{match[0]}</mark>
      {text.slice(match.index + match[0].length)}
    </>
  );
}

export function Transcript({ turns, draft }: { turns: Turn[]; draft: string }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, draft]);

  if (!turns.length && !draft) {
    return <p className="py-10 text-center text-sm text-muted">Your conversation will appear here as captions.</p>;
  }

  return (
    <ol className="flex flex-col gap-3" aria-label="Conversation transcript">
      {turns.map((t) => {
        const chip = t.verdict ? VERDICT_CHIP[t.verdict] : undefined;
        return (
          <li key={t.id} className={`flex flex-col gap-1 ${t.role === "user" ? "items-end" : "items-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${
                t.role === "user" ? `rounded-br-md bg-user ${t.action ? "italic text-muted" : ""}` : "rounded-bl-md bg-surface-2"
              }`}
            >
              <span className="sr-only">{t.role === "user" ? "You: " : "Lexi: "}</span>
              {t.text ? (t.role === "user" ? highlight(t.text, t.matchedForm) : t.text) : <span className="text-muted">…</span>}
              {t.interrupted && <span className="ml-1 text-xs text-muted">(interrupted)</span>}
              {t.typed && <span className="ml-1 text-xs text-muted">(typed)</span>}
            </div>
            {chip && <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${chip.className}`}>{chip.label}</span>}
          </li>
        );
      })}
      {draft && (
        <li className="flex justify-end">
          <div className="max-w-[85%] rounded-2xl rounded-br-md border border-dashed border-border px-4 py-2.5 text-[15px] italic text-muted">
            {draft}
          </div>
        </li>
      )}
      <div ref={endRef} />
    </ol>
  );
}
