import Groq from "groq-sdk";
import { redactSentence } from "@/lib/engine/redact";
import { applyAction, applyLearnerTurn, finishSession, parseSessionState, type LearnerAction, type Outcome } from "@/lib/engine/session";
import type { Analysis, Verification } from "@/lib/engine/types";
import { verifyUsage } from "@/lib/engine/verify";
import { getWord } from "@/lib/engine/words";
import { COACH_SYSTEM_PROMPT, renderDirective } from "@/lib/server/coachPrompt";
import { MODELS, errorResponse, getGroq, isModelAccessError } from "@/lib/server/groq";
import { judgeTurn } from "@/lib/server/judge";
import { rateLimit } from "@/lib/server/rateLimit";
import { SentenceSplitter } from "@/lib/voice/sentences";

export const maxDuration = 30;

type HistoryMessage = { role: "user" | "assistant"; content: string };

type TurnRequest = {
  state: unknown;
  utterance?: unknown;
  action?: unknown;
  history?: unknown;
};

/** Events streamed to the client as newline-delimited JSON. */
export type TurnEvent =
  | {
      type: "outcome";
      state: Outcome["state"];
      verdict: Outcome["verdict"];
      directive: Outcome["directive"]["kind"];
      sessionComplete: boolean;
      analysis: Analysis | null;
      verification: Verification | null;
      judgeModel: string | null;
      judgeFallback: boolean;
      judgeMs: number;
    }
  | { type: "text"; text: string }
  | { type: "done"; redactions: number; model: string; replyMs: number }
  | { type: "error"; message: string };

const HISTORY_LIMIT = 8;
const MAX_UTTERANCE = 600;

function parseHistory(raw: unknown): HistoryMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(-HISTORY_LIMIT)
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.slice(0, 800) }));
}

export async function POST(req: Request) {
  // Each turn makes up to two Groq calls (judge + coach).
  const limited = rateLimit(req, "turn", 20);
  if (limited) return limited;

  const body = (await req.json().catch(() => null)) as TurnRequest | null;
  const state = parseSessionState(body?.state);
  const history = parseHistory(body?.history);
  const utterance = typeof body?.utterance === "string" ? body.utterance.trim().slice(0, MAX_UTTERANCE) : "";
  const action = body?.action === "hint" || body?.action === "skip" || body?.action === "time_up" ? body.action : null;
  if (!state || (!utterance && !action)) {
    return Response.json({ error: "bad_request", message: "Invalid turn." }, { status: 400 });
  }

  // 1) Decide what happens (judge + deterministic engine).
  let outcome: Outcome;
  let analysis: Analysis | null = null;
  let verification: Verification | null = null;
  let judgeModel: string | null = null;
  let judgeFallback = false;
  const judgeStart = Date.now();
  try {
    if (action === "time_up") {
      const done = finishSession(state);
      outcome = { state: done, directive: { kind: "wrap_up", reason: "time_up" }, verdict: "none", redact: "none", sessionComplete: true };
    } else if (action) {
      outcome = applyAction(state, action as LearnerAction);
    } else {
      const word = state.current ? getWord(state.current.wordId) : undefined;
      const coachSaid = [...history].reverse().find((m) => m.role === "assistant")?.content ?? "";
      const judged = await judgeTurn(state, word, coachSaid, utterance);
      analysis = judged.analysis;
      judgeModel = judged.model;
      judgeFallback = judged.fallback;
      verification = word ? verifyUsage(utterance, word) : null;
      outcome = applyLearnerTurn(state, utterance, analysis, verification);
    }
  } catch (err) {
    return errorResponse(err);
  }
  const judgeMs = Date.now() - judgeStart;

  // 2) Open the coach stream before responding so provider errors become proper HTTP errors.
  const targetWord = outcome.state.current ? getWord(outcome.state.current.wordId) : undefined;
  const messages = [
    { role: "system" as const, content: COACH_SYSTEM_PROMPT },
    ...history,
    ...(utterance ? [{ role: "user" as const, content: utterance }] : []),
    { role: "system" as const, content: renderDirective(outcome.directive, outcome.state) },
  ];
  const open = (model: string) =>
    getGroq().chat.completions.create({
      model,
      stream: true,
      temperature: 0.6,
      reasoning_effort: "low",
      include_reasoning: false,
      max_completion_tokens: 500,
      messages,
    });

  const replyStart = Date.now();
  let model = MODELS.chat;
  let completion;
  try {
    completion = await open(model);
  } catch (err) {
    const retryable = (err instanceof Groq.APIError && err.status === 429) || isModelAccessError(err);
    if (!retryable || MODELS.chatFallback === model) return errorResponse(err);
    model = MODELS.chatFallback;
    try {
      completion = await open(model);
    } catch (fallbackErr) {
      return errorResponse(fallbackErr);
    }
  }

  const encoder = new TextEncoder();
  const send = (controller: ReadableStreamDefaultController<Uint8Array>, event: TurnEvent) =>
    controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      send(controller, {
        type: "outcome",
        state: outcome.state,
        verdict: outcome.verdict,
        directive: outcome.directive.kind,
        sessionComplete: outcome.sessionComplete,
        analysis,
        verification,
        judgeModel,
        judgeFallback,
        judgeMs,
      });

      // 3) Stream the reply sentence by sentence, keeping the target word out where required.
      const splitter = new SentenceSplitter();
      let redactions = 0;
      const emit = (sentence: string) => {
        const { text, removed } = redactSentence(sentence, targetWord, outcome.redact);
        redactions += removed;
        send(controller, { type: "text", text: text + " " });
      };
      try {
        for await (const chunk of completion) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) splitter.push(delta).forEach(emit);
        }
        const rest = splitter.flush();
        if (rest) emit(rest);
        if (redactions) console.info(`[turn] redacted target word ${redactions}x (${outcome.directive.kind})`);
        send(controller, { type: "done", redactions, model, replyMs: Date.now() - replyStart });
      } catch (err) {
        console.error("[turn] stream error", err);
        send(controller, { type: "error", message: "The coach's reply was cut off." });
      } finally {
        controller.close();
      }
    },
    cancel() {
      completion.controller.abort();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
