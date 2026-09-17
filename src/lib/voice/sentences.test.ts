import { test } from "node:test";
import assert from "node:assert/strict";
import { SentenceSplitter, chunkText, toSpeakable } from "./sentences.ts";

test("splits streamed text into sentences", () => {
  const s = new SentenceSplitter();
  const out: string[] = [];
  for (const d of ["Hi the", "re! Let's le", "arn a word. It's 3.5 ", "times better? Yes"]) out.push(...s.push(d));
  assert.deepEqual(out, ["Hi there!", "Let's learn a word.", "It's 3.5 times better?"]);
  assert.equal(s.flush(), "Yes");
  assert.equal(s.flush(), null);
});

test("closing quotes stay with their sentence", () => {
  const s = new SentenceSplitter();
  assert.deepEqual(s.push("For example, “Give a concise answer.” Think of a time? Yes. "), [
    "For example, “Give a concise answer.”",
    "Think of a time?",
    "Yes.",
  ]);
});

test("waits for whitespace after a terminator", () => {
  const s = new SentenceSplitter();
  assert.deepEqual(s.push("Great."), []);
  assert.deepEqual(s.push(" Next"), ["Great."]);
});

test("chunkText respects max length", () => {
  const text = "Meticulous means showing great attention to detail, being very careful and precise, like an engineer who checks every line of code twice before shipping it to production, even on a Friday evening when everyone else has gone home.";
  const chunks = chunkText(text, 200);
  assert.ok(chunks.length >= 2);
  for (const c of chunks) assert.ok(c.length <= 200, c);
  assert.equal(chunks.join(" "), text);
});

test("toSpeakable strips markdown", () => {
  assert.equal(toSpeakable("**Mitigate** means `reduce`"), "Mitigate means reduce");
});
