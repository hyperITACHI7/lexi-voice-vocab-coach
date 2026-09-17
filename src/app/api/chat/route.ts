import Groq from "groq-sdk";
import { MODELS, errorResponse, getGroq, isModelAccessError } from "@/lib/server/groq";
import { COACH_SYSTEM_PROMPT } from "@/lib/server/prompt";
import { rateLimit } from "@/lib/server/rateLimit";

export const maxDuration = 30;

type ChatMessage = { role: "user" | "assistant"; content: string };

const MAX_MESSAGES = 24;
const MAX_CHARS = 2000;

function parseMessages(body: unknown): ChatMessage[] | null {
  const raw = (body as { messages?: unknown })?.messages;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const messages: ChatMessage[] = [];
  for (const m of raw.slice(-MAX_MESSAGES)) {
    if (
      !m ||
      (m.role !== "user" && m.role !== "assistant") ||
      typeof m.content !== "string"
    ) {
      return null;
    }
    const content = m.content.trim().slice(0, MAX_CHARS);
    if (content) messages.push({ role: m.role, content });
  }
  return messages.length ? messages : null;
}

async function openStream(messages: ChatMessage[], model: string) {
  return getGroq().chat.completions.create({
    model,
    stream: true,
    temperature: 0.7,
    // gpt-oss models reason before answering: keep it brief and out of the spoken reply.
    reasoning_effort: "low",
    include_reasoning: false,
    max_completion_tokens: 400,
    messages: [{ role: "system", content: COACH_SYSTEM_PROMPT }, ...messages],
  });
}

export async function POST(req: Request) {
  const limited = rateLimit(req, "chat", 30);
  if (limited) return limited;

  const messages = parseMessages(await req.json().catch(() => null));
  if (!messages) {
    return Response.json({ error: "bad_request", message: "Invalid messages." }, { status: 400 });
  }

  let completion;
  let model = MODELS.chat;
  try {
    completion = await openStream(messages, model);
  } catch (err) {
    // Free-tier limits and project permissions are per model, so the fallback may still work.
    const retryable = (err instanceof Groq.APIError && err.status === 429) || isModelAccessError(err);
    if (retryable && MODELS.chatFallback !== model) {
      model = MODELS.chatFallback;
      try {
        completion = await openStream(messages, model);
      } catch (fallbackErr) {
        return errorResponse(fallbackErr);
      }
    } else {
      return errorResponse(err);
    }
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of completion) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) controller.enqueue(encoder.encode(delta));
        }
      } catch (err) {
        console.error("[chat] stream error", err);
      } finally {
        controller.close();
      }
    },
    cancel() {
      completion.controller.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Model": model,
    },
  });
}
