"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { Status } from "@/lib/voice/useVoiceCoach";

const LABELS: Record<Status, string> = {
  idle: "Ready when you are",
  loading: "Setting up your microphone…",
  listening: "Listening. Your turn to speak",
  hearing: "Hearing you…",
  holding: "Take your time…",
  thinking: "Lexi is thinking…",
  speaking: "Lexi is speaking",
  ended: "Session ended",
  error: "Something went wrong",
};

export function StatusOrb({ status, levelRef }: { status: Status; levelRef: RefObject<number> }) {
  const ringRef = useRef<HTMLDivElement>(null);

  // Animate the ring from the voice-detector's speech probability without re-rendering React.
  useEffect(() => {
    let raf = 0;
    let smooth = 0;
    const tick = () => {
      const active = status === "listening" || status === "hearing" || status === "holding";
      smooth = smooth * 0.8 + (active ? levelRef.current ?? 0 : 0) * 0.2;
      if (ringRef.current) ringRef.current.style.transform = `scale(${1 + smooth * 0.35})`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [status, levelRef]);

  const speaking = status === "speaking";
  const thinking = status === "thinking" || status === "loading";

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative grid size-36 place-items-center sm:size-44">
        <div
          ref={ringRef}
          className="absolute inset-0 rounded-full bg-accent-soft transition-colors"
          style={speaking ? { animation: "breathe 1.6s ease-in-out infinite" } : undefined}
        />
        {thinking && (
          <div
            className="absolute inset-3 rounded-full border-2 border-transparent border-t-accent"
            style={{ animation: "spin-slow 1s linear infinite" }}
          />
        )}
        <div
          className={`relative grid size-20 place-items-center rounded-full sm:size-24 ${
            status === "idle" || status === "ended" ? "bg-surface-2" : "bg-accent"
          }`}
        >
          <MicIcon className={status === "idle" || status === "ended" ? "text-muted" : "text-accent-text"} />
        </div>
      </div>
      <p className="text-sm text-muted" aria-live="polite">
        {LABELS[status]}
      </p>
    </div>
  );
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg className={`size-8 ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8" />
    </svg>
  );
}
