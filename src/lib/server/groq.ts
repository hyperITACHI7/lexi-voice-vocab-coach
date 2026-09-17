import Groq from "groq-sdk";

export const MODELS = {
  chat: process.env.GROQ_CHAT_MODEL ?? "openai/gpt-oss-120b",
  chatFallback: process.env.GROQ_CHAT_FALLBACK_MODEL ?? "openai/gpt-oss-20b",
  // The judge runs on a different model than the coach so the two calls per turn use separate free-tier limits.
  judge: process.env.GROQ_JUDGE_MODEL ?? "openai/gpt-oss-20b",
  judgeFallback: process.env.GROQ_JUDGE_FALLBACK_MODEL ?? "openai/gpt-oss-120b",
  stt: process.env.GROQ_STT_MODEL ?? "whisper-large-v3-turbo",
  sttFallback: process.env.GROQ_STT_FALLBACK_MODEL ?? "whisper-large-v3",
  tts: process.env.GROQ_TTS_MODEL ?? "canopylabs/orpheus-v1-english",
};

let client: Groq | null = null;

export function isGroqConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY);
}

export function getGroq(): Groq {
  if (!process.env.GROQ_API_KEY) {
    throw new MissingKeyError();
  }
  client ??= new Groq({ apiKey: process.env.GROQ_API_KEY, maxRetries: 0 });
  return client;
}

export class MissingKeyError extends Error {
  constructor() {
    super("GROQ_API_KEY is not set on the server.");
  }
}

/** Maps any thrown error to a JSON response the client can act on. */
export function errorResponse(err: unknown): Response {
  if (err instanceof MissingKeyError) {
    return Response.json({ error: "not_configured", message: err.message }, { status: 503 });
  }
  if (err instanceof Groq.APIError) {
    const status = err.status ?? 502;
    console.error(`[groq] ${status}`, err.message);
    const setup = setupMessage(err);
    if (setup) return Response.json({ error: "setup_required", message: setup }, { status });
    const code = status === 429 ? "rate_limited" : "provider_error";
    return Response.json({ error: code, message: "The AI provider returned an error. Please try again." }, { status });
  }
  console.error("[groq] unexpected", err);
  return Response.json({ error: "server_error", message: "Something went wrong." }, { status: 500 });
}

/** True when the model can't be used with this key (blocked, needs terms, or not enabled). */
export function isModelAccessError(err: unknown): boolean {
  return err instanceof Groq.APIError && (err.status === 403 || err.status === 404 || setupMessage(err) !== null);
}

function setupMessage(err: InstanceType<typeof Groq.APIError>): string | null {
  const raw = err.message ?? "";
  const model = raw.match(/model `([^`]+)`/)?.[1] ?? "a required model";
  if (/blocked at the project level/i.test(raw)) {
    return `Groq setup needed: "${model}" is blocked for this API key's project. Enable it at console.groq.com → Settings → Project → Limits.`;
  }
  if (/terms acceptance/i.test(raw)) {
    return `Groq setup needed: accept the terms for "${model}" once in the Groq Playground.`;
  }
  if (/does not exist or you do not have access/i.test(raw)) {
    return `Groq setup needed: this API key can't access "${model}".`;
  }
  return null;
}
