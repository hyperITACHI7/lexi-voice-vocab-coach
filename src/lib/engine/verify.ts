import type { Analysis, Verification, WordEntry } from "./types.ts";

export function normalize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9'\s-]/g, " ")
    .replace(/-/g, " ") // "mi-mi-mitigate" → separate tokens
    .split(/\s+/)
    .filter(Boolean);
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/** Allowed ASR spelling drift: none for short words, 1 for mid-length, 2 for long words. */
function maxDistance(form: string): number {
  if (form.length >= 8) return 2;
  if (form.length >= 6) return 1;
  return 0;
}

function windows(tokens: string[], size: number): string[] {
  const out: string[] = [];
  for (let i = 0; i + size <= tokens.length; i++) out.push(tokens.slice(i, i + size).join(" "));
  return out;
}

/** Deterministic check of whether the utterance contains the word (or an accepted form). */
export function verifyUsage(utterance: string, word: WordEntry): Verification {
  const tokens = normalize(utterance);
  const confusables = word.confusables.map((c) => c.toLowerCase());

  let confusableFound: string | null = null;
  for (const c of confusables) {
    if (windows(tokens, c.split(" ").length).includes(c)) confusableFound = c;
  }

  const forms = [...word.forms].sort((a, b) => b.length - a.length);
  // Exact matches first.
  for (const form of forms) {
    const f = form.toLowerCase();
    if (windows(tokens, f.split(" ").length).includes(f)) {
      return { formFound: true, matchedForm: f, confusableFound };
    }
  }
  // Then fuzzy matches, never onto a listed confusable.
  for (const form of forms) {
    const f = form.toLowerCase();
    const limit = maxDistance(f.replace(/ /g, ""));
    if (!limit) continue;
    for (const candidate of windows(tokens, f.split(" ").length)) {
      if (confusables.includes(candidate)) continue;
      if (levenshtein(candidate, f) <= limit) {
        return { formFound: true, matchedForm: candidate, confusableFound };
      }
    }
  }
  return { formFound: false, matchedForm: null, confusableFound };
}

/** Combines the code check with the judge: both must agree for a correct use. */
export function isCorrectUse(verification: Verification, analysis: Analysis): boolean {
  return verification.formFound && analysis.usageCorrect;
}

/** Regex matching any accepted form, for redacting the word from coach replies. */
export function formsPattern(word: WordEntry): RegExp {
  const escaped = [...word.forms]
    .sort((a, b) => b.length - a.length)
    .map((f) => f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+"));
  return new RegExp(`["“”‘’']?\\b(?:${escaped.join("|")})\\b["“”‘’']?`, "gi");
}
