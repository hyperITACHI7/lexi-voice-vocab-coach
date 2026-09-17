import { test } from "node:test";
import assert from "node:assert/strict";
import { WORDS } from "../../data/words.ts";
import { formsPattern } from "./verify.ts";
import { pickWords } from "./words.ts";

test("word bank has 20 unique words per level", () => {
  const ids = new Set(WORDS.map((w) => w.id));
  assert.equal(ids.size, WORDS.length);
  for (const level of ["intermediate", "upper_intermediate", "advanced"]) {
    assert.equal(WORDS.filter((w) => w.level === level).length, 20, level);
  }
});

test("every entry is complete and its forms include the word itself", () => {
  for (const w of WORDS) {
    const label = (w.wordLabel ?? w.id).toLowerCase();
    assert.ok(w.forms.map((f) => f.toLowerCase()).includes(label), `${w.id} forms must include "${label}"`);
    assert.ok(w.definition && w.example && w.misuse && w.collocations.length, w.id);
    assert.ok(w.tags.length > 0, `${w.id} needs tags`);
    assert.match(w.example, formsPattern(w), `${w.id} example should use the word`);
  }
});

test("hints and definitions never give the word away", () => {
  for (const w of WORDS) {
    for (const [name, text] of Object.entries({ ...w.hints, definition: w.definition })) {
      assert.doesNotMatch(text, formsPattern(w), `${w.id} ${name} leaks the word: "${text}"`);
    }
  }
});

test("confusables are not accepted forms", () => {
  for (const w of WORDS) {
    for (const c of w.confusables) assert.ok(!w.forms.includes(c), `${w.id}: ${c}`);
  }
});

test("pickWords prefers the learner's goal and respects level", () => {
  let seed = 1;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const ids = pickWords("upper_intermediate", "work", [], 3, random);
  assert.equal(ids.length, 3);
  for (const id of ids) {
    const w = WORDS.find((x) => x.id === id)!;
    assert.equal(w.level, "upper_intermediate");
    assert.ok(w.tags.includes("work"));
  }
});
