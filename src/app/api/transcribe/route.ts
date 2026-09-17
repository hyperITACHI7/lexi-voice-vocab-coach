import { MODELS, errorResponse, getGroq, isModelAccessError } from "@/lib/server/groq";
import { rateLimit } from "@/lib/server/rateLimit";

const MAX_BYTES = 8 * 1024 * 1024; // ~4 minutes of 16 kHz mono WAV

// Whisper tends to invent these on silence or noise.
const HALLUCINATIONS = new Set([
  "thank you.", "thanks for watching.", "thank you for watching.", "you", "bye.", ".",
  "thanks for watching!", "subscribe to my channel.",
]);

type Segment = { text: string; no_speech_prob?: number; avg_logprob?: number };

export async function POST(req: Request) {
  const limited = rateLimit(req, "transcribe", 30);
  if (limited) return limited;

  try {
    const form = await req.formData();
    const audio = form.get("audio");
    if (!(audio instanceof File) || audio.size === 0) {
      return Response.json({ error: "bad_request", message: "Missing audio." }, { status: 400 });
    }
    if (audio.size > MAX_BYTES) {
      return Response.json({ error: "too_large", message: "Audio is too long." }, { status: 413 });
    }

    const transcribe = (model: string) =>
      getGroq().audio.transcriptions.create({
        file: audio,
        model,
        language: "en",
        temperature: 0,
        response_format: "verbose_json",
      });
    let result;
    try {
      result = await transcribe(MODELS.stt);
    } catch (err) {
      if (!isModelAccessError(err) || MODELS.sttFallback === MODELS.stt) throw err;
      result = await transcribe(MODELS.sttFallback);
    }

    const segments = ((result as unknown as { segments?: Segment[] }).segments ?? []).filter(
      (s) => !((s.no_speech_prob ?? 0) > 0.6 && (s.avg_logprob ?? 0) < -0.8),
    );
    let text = (segments.length ? segments.map((s) => s.text).join("") : result.text ?? "").trim();
    if (HALLUCINATIONS.has(text.toLowerCase())) text = "";

    return Response.json({ text });
  } catch (err) {
    return errorResponse(err);
  }
}
