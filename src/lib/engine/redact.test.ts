import { test } from "node:test";
import assert from "node:assert/strict";
import { redactSentence } from "./redact.ts";
import { getWord } from "./words.ts";

const w = getWord("mitigate")!;

test("all: removes every form", () => {
  assert.deepEqual(redactSentence("Try 'mitigate' again. It's like mitigation.", w, "all"), {
    text: "Try that word again. It's like that word.",
    removed: 2,
  });
});

test("questions: teaching sentences keep the word, the mission question doesn't", () => {
  assert.equal(redactSentence("Today's word is mitigate.", w, "questions").removed, 0);
  assert.equal(redactSentence("Now tell me, in your own sentence, how you'd mitigate a delay.", w, "questions").removed, 1);
  assert.deepEqual(redactSentence("How would you mitigate that risk?", w, "questions"), {
    text: "How would you that word that risk?",
    removed: 1,
  });
});

test("questions: a quoted example sentence is not a mission prompt", () => {
  assert.equal(redactSentence("For example, “We mitigated the risk early.”", w, "questions").removed, 0);
});

test("none leaves text untouched", () => {
  assert.equal(redactSentence("We mitigated it.", w, "none").text, "We mitigated it.");
});
