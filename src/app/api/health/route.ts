import { MODELS, getGroq, isGroqConfigured, isModelAccessError } from "@/lib/server/groq";
import { encodeWav } from "@/lib/voice/wav";

// Probing Whisper costs a tiny request, so cache the answer per server instance.
let sttCache: { available: boolean; model: string | null; checkedAt: number } | null = null;
const STT_CACHE_MS = 5 * 60 * 1000;

async function probeStt() {
  if (sttCache && Date.now() - sttCache.checkedAt < STT_CACHE_MS) return sttCache;
  const file = new File([encodeWav(new Float32Array(1600))], "probe.wav", { type: "audio/wav" });
  let result = { available: false, model: null as string | null, checkedAt: Date.now() };
  for (const model of [...new Set([MODELS.stt, MODELS.sttFallback])]) {
    try {
      await getGroq().audio.transcriptions.create({ file, model, language: "en" });
      result = { available: true, model, checkedAt: Date.now() };
      break;
    } catch (err) {
      if (!isModelAccessError(err)) {
        // Rate limits or outages aren't a permissions problem; assume Whisper is usable.
        result = { available: true, model, checkedAt: Date.now() };
        break;
      }
    }
  }
  sttCache = result;
  return result;
}

export async function GET() {
  const groqConfigured = isGroqConfigured();
  const stt = groqConfigured ? await probeStt() : { available: false, model: null };
  return Response.json({ ok: true, groqConfigured, groqStt: stt.available, sttModel: stt.model });
}
