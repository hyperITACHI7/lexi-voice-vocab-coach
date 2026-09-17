import type {
  Analysis,
  Directive,
  Goal,
  HintLevel,
  Issue,
  Level,
  PraiseInfo,
  SessionState,
  Verdict,
  Verification,
  WordResult,
  WordStatus,
} from "./types.ts";
import { isCorrectUse } from "./verify.ts";
import { getWord, pickWords } from "./words.ts";

/**
 * How strictly the server must keep the target word out of the coach's reply:
 * - none: the word may be said (teaching done, reveal, wrap-up)
 * - questions: may be said while teaching, but not inside the mission question
 * - all: never (hints, repeats, redirects), so the learner has to recall it
 */
export type RedactMode = "none" | "questions" | "all";

export type Outcome = {
  state: SessionState;
  directive: Directive;
  verdict: Verdict;
  redact: RedactMode;
  sessionComplete: boolean;
};

export type LearnerAction = "hint" | "skip";

const LEVELS: Level[] = ["intermediate", "upper_intermediate", "advanced"];
const GOALS: Goal[] = ["work", "exams", "everyday"];

export function createSession(level: Level): SessionState {
  return { version: 1, level, goal: null, stage: "onboarding", queue: [], index: 0, current: null, results: [] };
}

function beginWord(state: SessionState, index: number): SessionState {
  const wordId = state.queue[index];
  return {
    ...state,
    stage: "mission",
    index,
    current: { wordId, attempts: 0, hintLevel: 0, issues: [] },
  };
}

function statusFor(hintLevel: HintLevel): WordStatus {
  if (hintLevel >= 4) return "revealed";
  if (hintLevel === 3) return "assisted";
  return "correct";
}

/** Records the current word's result and moves to the next word or the wrap-up. */
function finishWord(
  state: SessionState,
  result: WordResult,
  praise: PraiseInfo | undefined,
  verdict: Verdict,
  skippedWordId?: string,
): Outcome {
  const results = [...state.results, result];
  const nextIndex = state.index + 1;
  if (nextIndex < state.queue.length) {
    const next = beginWord({ ...state, results }, nextIndex);
    return {
      state: next,
      directive: { kind: "teach", wordId: next.current!.wordId, intro: "next", praiseFor: praise, skippedWordId },
      verdict,
      redact: "questions",
      sessionComplete: false,
    };
  }
  return {
    state: { ...state, results, stage: "done", current: null, index: nextIndex },
    directive: { kind: "wrap_up", praiseFor: praise, reason: "finished" },
    verdict,
    redact: "none",
    sessionComplete: true,
  };
}

function endEarly(state: SessionState, reason: "learner_ended" | "time_up"): Outcome {
  const done = finishSession(state);
  return {
    state: done,
    directive: { kind: "wrap_up", reason },
    verdict: "none",
    redact: "none",
    sessionComplete: true,
  };
}

/** Closes the session locally (End button, time cap). The unfinished word counts as skipped. */
export function finishSession(state: SessionState): SessionState {
  if (state.stage === "done") return state;
  const results = [...state.results];
  if (state.current) {
    const c = state.current;
    results.push({ wordId: c.wordId, status: "skipped", attempts: c.attempts, hintLevel: c.hintLevel, issues: c.issues });
  }
  return { ...state, results, stage: "done", current: null };
}

function escalateHint(state: SessionState, issue: Issue, correction: string, reason: "misused" | "requested" | "not_used", attempted: boolean): Outcome {
  const c = state.current!;
  const hintLevel = Math.min(4, c.hintLevel + 1) as HintLevel;
  const issues = issue === "none" ? c.issues : [...c.issues, issue];
  const current = { ...c, hintLevel, issues, attempts: c.attempts + (attempted ? 1 : 0) };
  const next = { ...state, current };
  if (hintLevel === 4) {
    return {
      state: next,
      directive: { kind: "reveal", wordId: c.wordId, issue, correction },
      verdict: attempted ? "revealed_retry" : "none",
      redact: "none",
      sessionComplete: false,
    };
  }
  return {
    state: next,
    directive: { kind: "hint", wordId: c.wordId, hintLevel: hintLevel as 1 | 2 | 3, issue, correction, reason },
    verdict: attempted ? "retry" : "none",
    // They already said the word but misused it: the coach may model the correct pattern.
    redact: reason === "misused" ? "none" : "all",
    sessionComplete: false,
  };
}

/** First learner reply: learn their goal, choose words, and teach the first one. */
export function startWords(state: SessionState, goal: Goal | null, random: () => number = Math.random): Outcome {
  const queue = pickWords(state.level, goal, [], undefined, random);
  const next = beginWord({ ...state, goal, queue }, 0);
  return {
    state: next,
    directive: { kind: "teach", wordId: next.current!.wordId, intro: "first" },
    verdict: "none",
    redact: "questions",
    sessionComplete: false,
  };
}

export function applyLearnerTurn(
  state: SessionState,
  utterance: string,
  analysis: Analysis,
  verification: Verification | null,
  random: () => number = Math.random,
): Outcome {
  if (state.stage === "done") return endEarly(state, "learner_ended");
  if (analysis.intent === "end_session") return endEarly(state, "learner_ended");
  if (state.stage === "onboarding") return startWords(state, analysis.goal, random);

  const c = state.current!;
  const stay = (directive: Directive, redact: RedactMode = "all"): Outcome => ({
    state,
    directive,
    verdict: "none",
    redact,
    sessionComplete: false,
  });

  switch (analysis.intent) {
    case "skip":
      return finishWord(
        state,
        { wordId: c.wordId, status: "skipped", attempts: c.attempts, hintLevel: c.hintLevel, issues: c.issues },
        undefined,
        "move_on",
        c.wordId,
      );
    case "hint_request":
      return escalateHint(state, "none", "", "requested", false);
    case "repeat_request":
      return stay({ kind: "repeat_mission", wordId: c.wordId }, c.hintLevel >= 4 ? "none" : "all");
    case "question":
      return stay({ kind: "answer_question", wordId: c.wordId }, c.hintLevel >= 4 ? "none" : "all");
    case "off_topic":
      return stay({ kind: "redirect", wordId: c.wordId }, c.hintLevel >= 4 ? "none" : "all");
    case "already_know":
      return stay({ kind: "prove_known", wordId: c.wordId });
  }

  // intent === "answer"
  const verified = verification ?? { formFound: false, matchedForm: null, confusableFound: null };
  if (isCorrectUse(verified, analysis)) {
    const attempts = c.attempts + 1;
    const status = statusFor(c.hintLevel);
    return finishWord(
      state,
      { wordId: c.wordId, status, attempts, hintLevel: c.hintLevel, bestSentence: utterance.trim(), issues: c.issues },
      { wordId: c.wordId, sentence: utterance.trim(), status, afterReveal: c.hintLevel >= 4 },
      "correct",
    );
  }

  const issue: Issue = !verified.formFound ? "not_used" : analysis.issue === "none" || analysis.issue === "not_used" ? "meaning" : analysis.issue;
  const correction = analysis.correction.trim();

  if (c.hintLevel >= 4) {
    // Already revealed and still not right: model the correct use and move on.
    const issues = [...c.issues, issue];
    return finishWord(
      state,
      { wordId: c.wordId, status: "revealed", attempts: c.attempts + 1, hintLevel: 4, issues },
      { wordId: c.wordId, sentence: utterance.trim(), status: "revealed", afterReveal: true, correction },
      "move_on",
    );
  }
  return escalateHint(state, issue, correction, issue === "not_used" ? "not_used" : "misused", true);
}

export function applyAction(state: SessionState, action: LearnerAction): Outcome {
  const analysis: Analysis = {
    intent: action === "hint" ? "hint_request" : "skip",
    goal: null,
    usedTargetWord: false,
    usageCorrect: false,
    issue: "none",
    correction: "",
  };
  if (state.stage !== "mission") {
    return state.stage === "onboarding" ? startWords(state, null) : endEarly(state, "learner_ended");
  }
  return applyLearnerTurn(state, "", analysis, null);
}

/** Validates session state received from the client. Returns null if it's malformed. */
export function parseSessionState(raw: unknown): SessionState | null {
  const s = raw as SessionState;
  if (!s || s.version !== 1 || !LEVELS.includes(s.level)) return null;
  if (s.goal !== null && !GOALS.includes(s.goal)) return null;
  if (!["onboarding", "mission", "done"].includes(s.stage)) return null;
  if (!Array.isArray(s.queue) || s.queue.length > 10 || !s.queue.every((id) => typeof id === "string" && getWord(id))) return null;
  if (!Number.isInteger(s.index) || s.index < 0 || s.index > s.queue.length) return null;
  if (!Array.isArray(s.results) || s.results.length > 10) return null;
  if (s.stage === "mission") {
    const c = s.current;
    if (!c || c.wordId !== s.queue[s.index] || !Number.isInteger(c.attempts) || c.hintLevel < 0 || c.hintLevel > 4) return null;
  } else if (s.current !== null) {
    return null;
  }
  return s;
}
