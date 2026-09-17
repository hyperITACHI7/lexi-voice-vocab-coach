# Lexi: Voice Vocabulary Coach (prototype)

A browser voice agent that helps intermediate English learners **use** new words out loud, not just recognize them.
Planning docs live in [`docs/`](docs/): research, problem statement, phased architecture, edge cases.

**Current phase:** Phase 1, voice walking skeleton (talk with the coach, learner-paced turn-taking).

## How it works (Groq-only pipeline)

```
mic → Silero VAD (browser) → /api/transcribe (Groq Whisper) → patience rules
    → /api/chat (Groq gpt-oss-120b, streamed) → sentence splitter → browser TTS or /api/speak (Groq Orpheus)
```

- **Patient turn-taking:** "wait / let me think" holds the turn; trailing off ("and…", "um") earns extra time.
- **Interruptions:** in headphones mode speak over Lexi; on speakers use the Interrupt button.
- **Free-tier friendly:** browser voice by default; the HD voice falls back automatically when Groq limits are hit.

## Run locally

```bash
cp .env.example .env.local   # then paste your GROQ_API_KEY
npm install                  # also copies VAD model/WASM into public/vad
npm run dev                  # http://localhost:3000
npm test                     # unit tests for turn-taking + sentence splitting
```

Use Chrome, Edge, or Safari. Mic access needs `localhost` or HTTPS.

## Deploy (Vercel)

```bash
npm i -g vercel
vercel link
vercel env add GROQ_API_KEY   # production + preview
vercel deploy --prod
```
