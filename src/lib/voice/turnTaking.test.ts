import { test } from "node:test";
import assert from "node:assert/strict";
import { decideTurn, isHoldRequest, looksUnfinished } from "./turnTaking.ts";

test("hold requests are recognised", () => {
  for (const s of ["Wait.", "wait a second", "Let me think.", "Um, let me think", "Hmm...", "Hold on please", "One sec!", "give me a moment"]) {
    assert.ok(isHoldRequest(s), s);
  }
  for (const s of ["Wait, I know this word", "I think it means careful", "Thinking about it, yes"]) {
    assert.ok(!isHoldRequest(s), s);
  }
});

test("trailing-off speech looks unfinished", () => {
  for (const s of ["I want to learn words for my", "We need to mitigate the risk and", "So basically,", "The answer is um.", "I would..."]) {
    assert.ok(looksUnfinished(s), s);
  }
  for (const s of ["We mitigated the risk.", "Work, mostly.", "Yes!", "I'm preparing for interviews."]) {
    assert.ok(!looksUnfinished(s), s);
  }
});

test("decideTurn", () => {
  assert.equal(decideTurn("   ", false), "empty");
  assert.equal(decideTurn("let me think", false), "hold_request");
  assert.equal(decideTurn("I usually go to the", false), "extend");
  assert.equal(decideTurn("I usually go to the", true), "commit");
  assert.equal(decideTurn("I prepare for exams.", false), "commit");
});

test("stripLeadingHolds removes preambles only before an answer", async () => {
  const { stripLeadingHolds } = await import("./turnTaking.ts");
  assert.equal(stripLeadingHolds("Let me think. We finally accomplished our goal."), "We finally accomplished our goal.");
  assert.equal(stripLeadingHolds("Um, wait. OK, the answer is mitigate."), "OK, the answer is mitigate.");
  assert.equal(stripLeadingHolds("Thinking about it, yes."), "Thinking about it, yes.");
  assert.equal(stripLeadingHolds("Let me think."), "Let me think.");
});

test("joinSegments lowercases mid-sentence continuations", async () => {
  const { joinSegments } = await import("./turnTaking.ts");
  assert.equal(joinSegments(["I want words for work, mostly for", "Job interviews."]), "I want words for work, mostly for job interviews.");
  assert.equal(joinSegments(["Let me think.", "We launched it."]), "Let me think. We launched it.");
  assert.equal(joinSegments(["and then", "I left"]), "and then I left");
  assert.equal(joinSegments(["", " hello "]), "hello");
});
