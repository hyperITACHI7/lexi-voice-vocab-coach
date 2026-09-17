import { test } from "node:test";
import assert from "node:assert/strict";
import { formsPattern, verifyUsage } from "./verify.ts";
import { getWord } from "./words.ts";

const mitigate = getWord("mitigate")!;
const tia = getWord("take-into-account")!;
const adapt = getWord("adapt")!;

test("exact form and inflections (E4.3)", () => {
  assert.equal(verifyUsage("We mitigated the risk.", mitigate).formFound, true);
  assert.equal(verifyUsage("Risk mitigation matters.", mitigate).matchedForm, "mitigation");
});

test("ASR spelling drift is tolerated (E4.1)", () => {
  assert.equal(verifyUsage("we need to mitigatte the risk", mitigate).formFound, true);
  assert.equal(verifyUsage("She is very meticulus", getWord("meticulous")!).formFound, true);
});

test("confusables are never fuzzy-matched (E4.2)", () => {
  const v = verifyUsage("This will militate against us", mitigate);
  assert.equal(v.formFound, false);
  assert.equal(v.confusableFound, "militate");
  assert.equal(verifyUsage("We will adopt the new process", adapt).formFound, false);
});

test("synonyms don't count (E4.4)", () => {
  assert.equal(verifyUsage("We reduced the risk a lot.", mitigate).formFound, false);
});

test("short words need exact matches", () => {
  assert.equal(verifyUsage("I had to adabt quickly", adapt).formFound, false);
  assert.equal(verifyUsage("I had to adapt quickly", adapt).formFound, true);
  assert.equal(verifyUsage("I want to attent the meeting", getWord("attend")!).formFound, true); // 6+ letters: 1 edit ok
});

test("phrases, punctuation and stutters (E4.9, E4.10)", () => {
  assert.equal(verifyUsage("We took the budget into account", tia).formFound, false); // split phrase
  assert.equal(verifyUsage("Taking into account, the cost is high.", tia).formFound, true);
  assert.equal(verifyUsage("We need to mi-mi-mitigate it", mitigate).formFound, true);
  assert.equal(verifyUsage("MITIGATE!!!", mitigate).formFound, true);
});

test("formsPattern redacts quoted and plain forms", () => {
  const out = 'Use “mitigate” here, or mitigation there, not mitigated.'.replace(formsPattern(mitigate), "that word");
  assert.equal(out, "Use that word here, or that word there, not that word.");
  assert.equal("Please take it into account".replace(formsPattern(tia), "X"), "Please take it into account");
});
