/**
 * Learner-paced turn-taking. Voice detection splits speech on short silences;
 * these rules decide whether a pause means "I'm done" or "I'm still thinking".
 */

export type Patience = "quick" | "balanced" | "patient";

export const PATIENCE: Record<Patience, { label: string; commitMs: number; holdMs: number }> = {
  // commitMs: extra silence after speech ends before replying (VAD adds ~600ms on top).
  // holdMs: extra wait when the learner trails off ("and…", "um").
  quick: { label: "Quick", commitMs: 500, holdMs: 2500 },
  balanced: { label: "Balanced", commitMs: 1200, holdMs: 4500 },
  patient: { label: "Patient", commitMs: 2400, holdMs: 7000 },
};

/** How long to wait after an explicit "wait / let me think" before replying anyway. */
export const HOLD_REQUEST_MAX_MS = 20_000;

export type TurnDecision = "empty" | "hold_request" | "extend" | "commit";

const HOLD_PHRASE = String.raw`(?:(?:ok(?:ay)?|so|um+|uh+|hmm+|erm*)[,.\s]*)*(?:wait|hold on|one sec(?:ond)?|just a (?:sec(?:ond)?|moment|minute)|give me a (?:sec(?:ond)?|moment|minute)|let me think(?: about it)?|i need to think|thinking|um+|uh+|hmm+|erm*)(?:[,.!…\s]+(?:please|a sec(?:ond)?|a moment))?`;

const HOLD_REQUEST = new RegExp(String.raw`^${HOLD_PHRASE}[.!?,…\s]*$`, "i");
// Hold phrases at the start of a longer answer ("Let me think. We launched…"); requires punctuation after.
const LEADING_HOLDS = new RegExp(String.raw`^(?:${HOLD_PHRASE}[.!?,…]+\s*)+`, "i");

// Words that rarely end a finished spoken sentence.
const TRAILING = new Set([
  "and", "but", "or", "so", "because", "cause", "if", "when", "while", "then", "that", "which", "who",
  "the", "a", "an", "to", "of", "in", "on", "at", "for", "with", "from", "about", "into", "by",
  "my", "your", "his", "her", "their", "our", "its", "is", "are", "was", "were", "be", "am",
  "i", "we", "you", "they", "he", "she", "it", "will", "would", "can", "could", "should",
  "um", "umm", "uh", "uhh", "erm", "er", "hmm", "like", "maybe", "very", "really", "more", "most",
]);

export function isHoldRequest(text: string): boolean {
  return HOLD_REQUEST.test(text.trim());
}

/** Removes "wait / let me think" preambles once the learner has gone on to answer. */
export function stripLeadingHolds(text: string): string {
  const stripped = text.trim().replace(LEADING_HOLDS, "");
  if (!stripped) return text.trim();
  return stripped[0].toUpperCase() + stripped.slice(1);
}

/** Joins transcribed speech segments, undoing Whisper's capitalization after a mid-sentence pause. */
export function joinSegments(segments: string[]): string {
  let out = "";
  for (const raw of segments) {
    const seg = raw.trim();
    if (!seg) continue;
    if (!out) {
      out = seg;
      continue;
    }
    const continues = !/[.!?…]$/.test(out) && /^[A-Z][a-z]/.test(seg) && !/^I\b/.test(seg);
    out = `${out} ${continues ? seg[0].toLowerCase() + seg.slice(1) : seg}`;
  }
  return out.replace(/\s+/g, " ");
}

export function looksUnfinished(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/(?:,|\.\.\.|…|-|—)$/.test(t)) return true;
  const words = t.toLowerCase().replace(/[.!?,;:"')\]]+$/g, "").split(/\s+/);
  return TRAILING.has(words[words.length - 1] ?? "");
}

export function decideTurn(text: string, alreadyExtended: boolean): TurnDecision {
  const t = text.trim();
  if (!t) return "empty";
  if (isHoldRequest(t)) return "hold_request";
  if (!alreadyExtended && looksUnfinished(t)) return "extend";
  return "commit";
}
