# Lexi: Voice Vocabulary Coach (prototype)

A browser voice agent that helps intermediate English learners **use** new words out loud, not just recognize them.
Planning docs live in [`docs/`](docs/): research, problem statement, phased architecture, edge cases.

**Current phase:** Phase 2, core learning loop.

## How a session works

1. Pick a level and tell Lexi what you want words for (work, exams, everyday).
2. For each of 3 words, Lexi teaches it, then sets a short speaking challenge. The word stays hidden, so you have to recall it.
3. Your answer is checked twice: code confirms you said the word (tolerating speech-recognition typos, rejecting look-alikes), and a judge model checks the meaning and grammar around it.
4. Wrong or stuck? Hints escalate: meaning → first sound → comparison → reveal. Hint and Skip buttons are always there.
5. A recap shows what you used on your own, with help, or need to review.

## Architecture

```
mic → Silero VAD → /api/transcribe (Whisper) → patience rules
    → /api/turn: judge (gpt-oss-20b) + code check → lesson engine → coach (gpt-oss-120b, streamed)
      → target word redacted where recall is required → browser TTS / Groq Orpheus
```

- `src/lib/engine`: pure, unit-tested lesson logic (state machine, verification, redaction)
- `src/data/words.ts`: curated word bank (60 words, 3 levels)
- `src/lib/server`: judge + coach prompts, Groq client with model fallbacks
- `src/lib/voice`: turn-taking, speech queue, voice hook

## Run locally

```bash
cp .env.example .env.local   # then paste your GROQ_API_KEY
npm install                  # also copies VAD model/WASM into public/vad
npm run dev                  # http://localhost:3000
npm test                     # unit tests (engine, verifier, turn-taking)
npx tsx --env-file=.env.local scripts/eval-judge.ts   # judge agreement eval (32 labeled attempts)
node scripts/drive-turns.mjs                           # scripted conversation against /api/turn
```

Use Chrome, Edge, or Safari. Mic access needs `localhost` or HTTPS.

## Deploy (Vercel)

```bash
npm i -g vercel
vercel link
vercel env add GROQ_API_KEY   # production + preview
vercel deploy --prod
```
