"use client";

import { useEffect, useRef } from "react";
import type { Turn } from "@/lib/voice/useVoiceCoach";

export function Transcript({ turns, draft }: { turns: Turn[]; draft: string }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, draft]);

  if (!turns.length && !draft) {
    return (
      <p className="py-10 text-center text-sm text-muted">
        Your conversation will appear here as captions.
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-3" aria-label="Conversation transcript">
      {turns.map((t) => (
        <li key={t.id} className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}>
          <div
            className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${
              t.role === "user" ? "rounded-br-md bg-user" : "rounded-bl-md bg-surface-2"
            }`}
          >
            <span className="sr-only">{t.role === "user" ? "You: " : "Lexi: "}</span>
            {t.text || <span className="text-muted">…</span>}
            {t.interrupted && <span className="ml-1 text-xs text-muted">(interrupted)</span>}
            {t.typed && <span className="ml-1 text-xs text-muted">(typed)</span>}
          </div>
        </li>
      ))}
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
