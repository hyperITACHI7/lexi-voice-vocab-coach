export type Level = "intermediate" | "upper_intermediate" | "advanced";
export type Goal = "work" | "exams" | "everyday";

export type WordEntry = {
  id: string;
  /** Display form when it differs from the id (phrases). */
  wordLabel?: string;
  level: Level;
  pos: string;
  tags: Goal[];
  definition: string;
  example: string;
  collocations: string[];
  /** Every form that counts as "using the word" (inflections, derivations, spelling variants). */
  forms: string[];
  misuse: string;
  /** Real words that sound similar but must NOT be fuzzy-matched onto this word. */
  confusables: string[];
  hints: { meaning: string; sound: string; contrast: string };
};

/** 0 = none, 1 = meaning cue, 2 = first sound, 3 = synonym contrast, 4 = word revealed. */
export type HintLevel = 0 | 1 | 2 | 3 | 4;

export type WordStatus = "correct" | "assisted" | "revealed" | "skipped";

export type WordResult = {
  wordId: string;
  status: WordStatus;
  attempts: number;
  hintLevel: HintLevel;
  bestSentence?: string;
  issues: Issue[];
};

export type Stage = "onboarding" | "mission" | "done";

export type SessionState = {
  version: 1;
  level: Level;
  goal: Goal | null;
  stage: Stage;
  queue: string[];
  index: number;
  current: {
    wordId: string;
    attempts: number;
    hintLevel: HintLevel;
    issues: Issue[];
  } | null;
  results: WordResult[];
};

export type Intent =
  | "answer"
  | "hint_request"
  | "skip"
  | "already_know"
  | "repeat_request"
  | "question"
  | "end_session"
  | "off_topic";

export type Issue = "none" | "meaning" | "form" | "collocation" | "grammar" | "not_used";

/** What the judge model concluded about a learner turn. */
export type Analysis = {
  intent: Intent;
  goal: Goal | null;
  usedTargetWord: boolean;
  usageCorrect: boolean;
  issue: Issue;
  correction: string;
};

/** Deterministic check of the learner's utterance against the word's forms. */
export type Verification = {
  formFound: boolean;
  matchedForm: string | null;
  /** A listed confusable was said instead (e.g. "militate" for "mitigate"). */
  confusableFound: string | null;
};

export type Verdict = "correct" | "retry" | "revealed_retry" | "move_on" | "none";

/** Instruction for the coach model: what to say this turn. Code decides; the model phrases it. */
export type Directive =
  | { kind: "teach"; wordId: string; intro: "first" | "next"; praiseFor?: PraiseInfo; skippedWordId?: string }
  | { kind: "hint"; wordId: string; hintLevel: 1 | 2 | 3; issue: Issue; correction: string; reason: "misused" | "requested" | "not_used" }
  | { kind: "reveal"; wordId: string; issue: Issue; correction: string }
  | { kind: "repeat_mission"; wordId: string }
  | { kind: "answer_question"; wordId: string }
  | { kind: "redirect"; wordId: string }
  | { kind: "prove_known"; wordId: string }
  | { kind: "wrap_up"; praiseFor?: PraiseInfo; reason: "finished" | "learner_ended" | "time_up" };

export type PraiseInfo = { wordId: string; sentence: string; status: WordStatus; afterReveal: boolean; correction?: string };
