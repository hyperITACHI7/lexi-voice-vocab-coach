import type { RedactMode } from "./session.ts";
import type { WordEntry } from "./types.ts";
import { formsPattern } from "./verify.ts";

export const REDACTION = "that word";

/** The mission is the part that asks the learner to produce the word, usually a question. */
function isMissionPrompt(sentence: string): boolean {
  return sentence.includes("?") || /\b(?:sentence|new word|your own)\b/i.test(sentence);
}

/**
 * Keeps the target word out of a coach sentence when the learner is supposed to recall it.
 * Returns the (possibly rewritten) sentence and how many times the word was removed.
 */
export function redactSentence(sentence: string, word: WordEntry | undefined, mode: RedactMode): { text: string; removed: number } {
  if (!word || mode === "none") return { text: sentence, removed: 0 };
  if (mode === "questions" && !isMissionPrompt(sentence)) return { text: sentence, removed: 0 };
  let removed = 0;
  const text = sentence.replace(formsPattern(word), () => {
    removed++;
    return REDACTION;
  });
  return { text, removed };
}
