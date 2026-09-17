import { MODELS, errorResponse, getGroq } from "@/lib/server/groq";
import { rateLimit } from "@/lib/server/rateLimit";

const VOICES = new Set(["autumn", "diana", "hannah", "austin", "daniel", "troy"]);
const MAX_CHARS = 200; // Orpheus input limit

export async function POST(req: Request) {
  // Orpheus free tier is ~10 RPM / 100 RPD; the client falls back to browser TTS on 429.
  const limited = rateLimit(req, "speak", 10);
  if (limited) return limited;

  const body = (await req.json().catch(() => null)) as { text?: unknown; voice?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const voice = typeof body?.voice === "string" && VOICES.has(body.voice) ? body.voice : "diana";
  if (!text || text.length > MAX_CHARS) {
    return Response.json({ error: "bad_request", message: "Text must be 1–200 characters." }, { status: 400 });
  }

  try {
    const speech = await getGroq().audio.speech.create({
      model: MODELS.tts,
      voice,
      input: text,
      response_format: "wav",
    });
    return new Response(await speech.arrayBuffer(), {
      headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
