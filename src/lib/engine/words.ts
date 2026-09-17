import { WORDS } from "../../data/words.ts";
import type { Goal, Level, WordEntry } from "./types.ts";

const BY_ID = new Map(WORDS.map((w) => [w.id, w]));

export function getWord(id: string): WordEntry | undefined {
  return BY_ID.get(id);
}

export function wordLabel(word: WordEntry): string {
  return word.wordLabel ?? word.id;
}

export const WORDS_PER_SESSION = 3;

/**
 * Picks new words for a session, preferring ones tagged with the learner's goal.
 * `random` is injectable so tests are deterministic.
 */
export function pickWords(
  level: Level,
  goal: Goal | null,
  exclude: string[] = [],
  count = WORDS_PER_SESSION,
  random: () => number = Math.random,
): string[] {
  const pool = WORDS.filter((w) => w.level === level && !exclude.includes(w.id));
  const shuffled = pool
    .map((w) => ({ w, key: random() - (goal && w.tags.includes(goal) ? 1 : 0) }))
    .sort((a, b) => a.key - b.key)
    .map((x) => x.w.id);
  return shuffled.slice(0, count);
}
