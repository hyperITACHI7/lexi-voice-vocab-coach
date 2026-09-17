# Research: Voice Agents for Vocabulary Learning

> **Purpose:** Evidence base for `problem_Statement.md`, `phased_Architecture.md`, and `edge_Case.md`.
> **Observed:** 2026-09-17 · **Method:** desk research (product reviews, vendor docs, published learning-science studies, app-store/user complaint roundups).
> **Confidence note:** Competitor details come from third-party reviews and vendor marketing, not hands-on testing. Treat claims as *reported*, not *verified* (per the competitive-analysis rule: separate verified facts from marketing claims).

---

## 1. The decision this research supports

We need to build a **working voice-agent prototype that helps people learn vocabulary** and share a link. The research answers three questions:

1. How do existing voice / AI tutors handle vocabulary today?
2. What do learners complain about, and what does learning science say actually works?
3. Where is the gap we can realistically own in a prototype?

---

## 2. Market landscape — three kinds of alternatives

A learner who wants a bigger vocabulary currently "hires" one of three kinds of products (plus the non-product workaround).

| Category | Examples | What they're good at | What they miss |
|---|---|---|---|
| **A. Vocabulary / SRS apps (text-first)** | Anki, Vocabulary.com, Elevate, Word of the Day apps, Quizlet (Q-Chat) | Spaced repetition, adaptive quizzes, gamified streaks | Recognition only (tap/type the meaning). The learner never **says** the word in a real sentence. No conversation. |
| **B. AI speaking tutors (voice-first)** | Duolingo Max Video Call (Lily), Speak, Praktika, Talkpal, Loora, Langotalk, ISSEN | Real-time spoken conversation, role-play scenarios, some pronunciation feedback | Vocabulary is an **afterthought**: saved phrases rarely come back into later conversations; weak or absent SRS; generic post-session summaries. |
| **C. General voice assistants** | ChatGPT voice, Gemini Live | Flexible, can "quiz me on words" if asked | No curriculum, no progress tracking, no scheduling. The learner has to design the learning themselves each time. |
| **D. Workaround** | Notebook or phone notes of new words, rereading lists, "try to use it in a sentence" | Free, personal (words come from the learner's own life) | No feedback on whether the usage was correct. Easy to forget. |

### 2.1 Competitor feature snapshot (as reported)

| Product | Voice conversation | Turn-taking | Vocabulary mechanism | Cross-session memory | Reported weaknesses |
|---|---|---|---|---|---|
| Duolingo Max – Video Call | Yes, character-based (Lily) | Real-time | Spaced repetition in core app; call adapts to level | Adapts to course progress | Paid tier only; call isn't built around target vocabulary |
| Speak | Yes, scenario role-play | No smart turn detection | "Phrasebook" saves phrases | Limited | **No SRS; saved phrases never come back into chats or lessons**; brief, generic summaries; lenient speech recognition |
| Praktika | Yes, 3D avatars | No smart turn detection | Goal-based daily lesson plans | Limited | Too easy for intermediates; card required up front for the trial |
| Talkpal | Yes, call mode, debates, role-play | No smart turn detection | Sentence drills | Limited | Unreliable pronunciation feedback; synthetic voice |
| Loora | Yes, professional English | Real-time | Post-session summaries | Inconsistent | English only |
| Langotalk | Yes, 200+ tutor personas | Push-to-talk | Real-time grammar correction | Partial | Push-to-talk breaks the flow |
| ISSEN | Yes, 60+ languages | **Smart turn detection** | **Conversation-anchored SRS flashcards** (words from your sessions, with context) | **Yes** | Not for beginners; pronunciation feedback only in shadowing mode |
| ELSA Speak | Mostly scripted prompts | n/a | Pronunciation drills | Yes (phoneme level) | Doesn't build conversational fluency |
| Open-source "voice vocabulary agent" (Gradio + Transformers) | Voice quiz | Turn-based | Word → definition → quiz, points, streaks, hints, 3 levels | No | Quiz of obscure words; no real conversation, no spacing |

**Category-wide gap (reported by ISSEN's review):** smart turn detection and cross-session memory appear together in only one app. Even there, vocabulary review happens on **flashcards**, not back **inside speech**.

---

## 3. What learners complain about (voice-of-customer patterns)

From review roundups and app-store/user complaint summaries:

1. **"It cuts me off."** Speech detection assumes native-speed speakers. Learners need time to form a sentence and get interrupted mid-thought.
2. **"Vocabulary feels like an afterthought."** Flashcards lack spacing, can't be reviewed outside their unit, and saved words **never reappear in conversation**.
3. **"Conversations get repetitive."** Same scenarios, same questions, especially at higher levels.
4. **"It forgets me."** Mistakes from last session aren't remembered. Summaries don't add up across sessions.
5. **"It lets me pass when I'm wrong."** Lenient recognition means mispronounced or misused words still count as correct.
6. **"Structured course, free chat, and review don't connect."** Three separate features, no single learning loop.

---

## 4. What learning science says works

| Principle | Evidence (summary) | Design implication |
|---|---|---|
| **Retrieval practice > re-study** | Actively recalling a word beats re-reading it across test types. | The agent should make the learner **pull the word out of memory**, not repeat definitions at them. |
| **Spaced retrieval** | Repeated spaced retrieval improves recall of form and meaning and transfers to new contexts. Spaced retrieval practice has also been linked to longer stretches of sustained speech in EFL learners. | Words have to come back after growing intervals (e.g., same session → next day → 3 days → 7 days). |
| **Generation effect / productive use** | Producing the word in a **new context** strengthens the form-meaning link more than recognizing it. | The key test is "can you **use** it?", not "do you recognize it?". |
| **Multiple knowledge dimensions** | Phonological modelling, semantic explanation, morphological breakdown, and repeated retrieval each boost retention more than simple exposure. | Teach the sound (agent says it), meaning, a word family/morphology tip, and collocations. |
| **Conversation practice improves speaking** | Duolingo's Video Call studies: intermediate English learners using it ≥2×/day improved more on a standardized speaking test after one month; Spanish learners reported higher confidence. | Voice practice has shown value. Our bet is to aim it at **specific target words**. |

**Receptive vs. productive vocabulary** is the key idea. Most people *recognize* far more words than they *use*. Category A apps train recognition, and Category B apps train general fluency. **Nobody deliberately trains the move from "I know this word" to "I naturally use this word when speaking."**

---

## 5. Opportunity: where we can stand out

### 5.1 Differentiators that are table stakes (we must have them, but they won't make us stand out)
- Real-time spoken conversation with natural voice
- Level selection
- Definitions + example sentences
- Some progress indicator

### 5.2 Differentiators we can own

| # | Idea | Gap it closes | Why it's feasible in a prototype |
|---|---|---|---|
| **D1** | **"Use-It Missions": productive-retrieval conversations.** After teaching a word, the agent sets up a short role-play where the learner has to **produce** the word. The agent must never say the word first. | Nobody trains receptive → productive. Saved words never return to speech. | The LLM handles the role-play. Tool calls report "word used? correctly?" |
| **D2** | **Spaced repetition inside conversation, not flashcards.** Due words are woven into the next session's warm-up chat. | "Vocabulary is an afterthought"; SRS lives on separate flashcards. | Simple Leitner scheduler in code. Due words get injected into session instructions. |
| **D3** | **Patient, learner-paced turn-taking.** A long "thinking" tolerance, a spoken "give me a second" support, and no cutting off. | "It cuts me off." | Realtime APIs expose semantic VAD with low eagerness (waits up to ~8s). |
| **D4** | **Hint ladder instead of giving the answer.** Meaning cue → first sound → contrast with a synonym → reveal and retry later. | Tutors either give up the answer or let wrong answers pass. | Prompt policy + a `hint_level` field in tool calls. |
| **D5** | **Honest usage verification.** A word counts as "used" only if the (a) transcript contains an accepted form and (b) the meaning/collocation is judged correct. Code checks (a), the model judges (b). | "It lets me pass when I'm wrong." | Deterministic lemma matching + model judgment, logged with the evidence quote. |
| **D6** | **Bring Your Own Words.** The learner says or types words they met today (in a meeting, article, or show), and the agent builds the lesson around them. | Curricula feel generic and don't match real life. | Word gets validated and enriched by the LLM, then enters the same loop. |
| **D7** | **Mastery defined by use, not by clicks.** A word is "owned" when the learner has used it correctly, unprompted, in 2+ spaced sessions. | Streaks and points measure activity, not learning. | Derived from D2 + D5 data. |
| **D8** | **Cumulative recap card.** Words owned / in progress / struggled with, plus the learner's own best sentence for each word. | Generic, non-cumulative summaries. | Rendered from the local progress store. |

**Positioning line:** *Other apps help you recognize words. This one gets you using them out loud, then brings them back until they stick.*

### 5.3 Deliberately **not** pursuing in the MVP
- Pronunciation scoring at phoneme level (ELSA's territory; needs specialized models)
- Avatars/video (Praktika/Duolingo territory; high cost, low learning value for vocabulary)
- Many languages at once (validate the loop in English first)
- Social/live rooms

---

## 6. Technology scan for a prototype (voice stack)

| Option | Type | Strengths | Trade-offs for us |
|---|---|---|---|
| **OpenAI Realtime API** (WebRTC in browser, ephemeral client secret minted server-side) | Speech-to-speech, single API | Barge-in, low first-audio latency, **function calling mid-conversation**, **semantic VAD with `eagerness: low`** (max ~8s wait), simple browser integration | Reported ~$0.06–0.10/min; token-based billing is harder to forecast. Needs a small server route to keep the API key secret. |
| **ElevenLabs Agents** | Hosted agent platform | Very natural voices, low-latency TTS, knowledge base (RAG), client/server tools, fast no-code setup | Reported ~$0.07–0.30/min. Custom UI (word cards, progress) is harder. Less control over the learning state machine. |
| **Vapi / Retell / LiveKit / Pipecat** | Orchestration of STT + LLM + TTS | Swap providers freely; telephony | More moving parts than a prototype needs |
| **Browser Web Speech API + text LLM** | DIY | Free-ish, no vendor | Speech recognition missing or inconsistent across browsers (e.g., Firefox); robotic TTS; poor turn-taking. Fallback only. |

**Recommendation:** OpenAI Realtime API over WebRTC, in a Next.js web app deployed on Vercel. Reasons: turn-taking control (D3), in-conversation tool calls (D1/D2/D5), and a custom UI in one shareable link. Keep ElevenLabs Agents as a **Phase 1 no-code fallback** if the custom build is blocked. Full reasoning is in `phased_Architecture.md`.

---

## 7. Key assumptions to validate (inputs to hypotheses)

1. Intermediate learners feel the "I know it but never use it" gap strongly enough to practice for it.
2. Being made to **produce** a word in voice feels challenging but not stressful.
3. A speech-to-speech model can reliably avoid saying the target word before the learner does.
4. The model can judge "correct usage" well enough for learners to trust it (with a code check alongside).
5. Learners come back for spaced reviews when the review is a short conversation, not flashcards.

---

## Sources

- [AI Voice Language Learning Apps – ISSEN (Jul 2026)](https://www.issen.com/blog/ai-language-learning-apps-voice-practice/)
- [10 Best AI Language Learning Apps for Speaking (2026) – Talkio](https://www.talkio.ai/blog/best-ai-language-speaking-practice-apps-in-2026)
- [What's the best AI language learning app in 2026? – LanguaTalk](https://languatalk.com/blog/whats-the-best-ai-for-language-learning/)
- [Speak App Review 2026 – LanguaTalk](https://languatalk.com/blog/speak-app-review/)
- [Speak Review 2026 – Languavibe](https://languavibe.com/speak-review/)
- [Best AI Speaking Apps 2026 – Lingtuitive](https://lingtuitive.com/blog/best-ai-speaking-apps)
- [6 Best AI Language Learning Apps in 2026 – Upskillist](https://www.upskillist.com/blog/best-ai-language-learning-apps/)
- [Speak vs ELSA Speak (2026) – EngVarta](https://engvarta.com/speak-vs-elsa-speak-english-fluency-comparison/)
- [Duolingo Video Call – duoplanet](https://duoplanet.com/duolingo-video-call/)
- [Duolingo Video Call research report](https://blog.duolingo.com/video-call-research-report)
- [voice-vocabulary-agent – GitHub](https://github.com/RiyaAddanki/voice-vocabulary-agent)
- [Repetition, Retrieval, and Spaced Practice – ResearchGate](https://www.researchgate.net/publication/398256768_Repetition_Retrieval_and_Spaced_Practice)
- [Spaced Retrieval practice with A1 EFL adult learners – Frontiers](https://www.frontiersin.org/journals/education/articles/10.3389/feduc.2025.1715111/full)
- [What Really Matters in Vocabulary Acquisition? – The Language Gym](https://gianfrancoconti.com/2025/04/26/what-really-matters-in-vocabulary-acquisition-a-ranked-analysis-of-key-influencing-factors/)
- [Retrieval practice in digital flashcard vocabulary learning – PMC](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12649105/)
- [11 Best Vocabulary Apps (2026) – ScoreBeyond](https://scorebeyond.com/best-vocabulary-apps/)
- [Best API for building a speech-to-speech voice agent in 2026 – AssemblyAI](https://www.assemblyai.com/blog/best-speech-to-speech-voice-agent-api)
- [OpenAI Realtime API vs LiveKit Agents vs ElevenLabs – Kanopy](https://kanopylabs.com/blog/openai-realtime-api-vs-livekit-agents-vs-elevenlabs)
- [OpenAI Realtime API – getting started](https://developers.openai.com/api/docs/guides/realtime)
- [OpenAI Realtime – Voice activity detection](https://developers.openai.com/api/docs/guides/realtime-vad)
- [OpenAI – Create client secret](https://platform.openai.com/docs/api-reference/realtime-sessions/create-realtime-client-secret)
- [ElevenLabs Agents](https://elevenlabs.io/agents) · [Knowledge base docs](https://elevenlabs.io/docs/agents-platform/customization/knowledge-base)
