# Problem Statement: Voice Agent for Vocabulary Learning

> **Status:** Draft v1 · **Date:** 2026-09-17 · **Evidence base:** [`research.md`](research.md)
> **Brief:** "Build a simple working prototype of a voice agent that helps people learn vocabulary. Share the prototype link."
> **Frameworks used:** Problem framing (5 Ws + template), Jobs to Be Done, lean personas, Outcome → Problem → Solution, hypothesis-driven design, KPI tree.

---

## 1. Problem (one sentence)

**Intermediate English learners recognize many words they never actually use when speaking, because today's vocabulary tools only test recognition and today's AI speaking tutors don't target specific words or bring them back. So new words stay passive and fade within days.**

### "In what ways might we…" framing
> In what ways might we help a learner go from *"I know what this word means"* to *"I used this word correctly, out loud, without being told to"* in a few minutes of voice practice a day?

---

## 2. Unpacking the brief (chunking down)

The brief is broad. This is how each word in it is read, and the assumptions behind each reading:

| Brief term | Our interpretation | Assumption we're making (to challenge later) |
|---|---|---|
| "voice agent" | A real-time, two-way spoken conversation in the browser, with barge-in and natural turn-taking. Not a text chatbot with TTS added on. | Voice adds learning value beyond text: speaking a word is productive retrieval. |
| "helps people" | A defined focal persona (below), not "everyone". | Narrowing to one persona makes a better prototype than serving all learners. |
| "learn" | Durable, **usable** knowledge: the learner can later produce the word correctly in context. Hearing a definition doesn't count. | Productive use is the right bar for "learned". |
| "vocabulary" | English words and short collocations at B1–C1 difficulty (e.g., *mitigate, meticulous, reluctant, take into account*). | English first; the loop generalizes to other languages later. |
| "simple working prototype" | One core loop that works end to end at a public link, is usable by a stranger in under 1 minute, and needs no install and no signup. | Stakeholders judge it by trying it, not by reading about it. |

---

## 3. The five Ws

| W | Answer | Evidence |
|---|---|---|
| **Who** | Non-native English speakers at an intermediate level (≈B1–B2): students preparing for exams/interviews and early-career professionals. Secondary: native speakers expanding their vocabulary for exams or work. | AI speaking apps target this band. Reviews say intermediates find beginner-focused apps too easy (`research.md` §2.1). |
| **What** | New words stay *receptive*: learners recognize them but don't retrieve them while speaking, and forget them without spaced review. | Learning science: retrieval and productive generation beat exposure (§4). |
| **Where** | Speaking situations: interviews, meetings, presentations, exams (IELTS/TOEFL speaking), and casual conversation. | Scenario role-play is the dominant pattern in speaking apps (§2.1). |
| **When** | (a) Right after meeting a new word, when there's no chance to use it; (b) days later, when it's forgotten because nothing brought it back. | "Saved phrases never reintegrated"; "no SRS" complaints (§3). |
| **Why fix it** | Vocabulary in active use is what makes someone sound fluent and precise. Time spent on flashcards that never reaches speech is wasted effort, and it hurts confidence. | Duolingo study: speaking practice → measurable speaking gains + confidence (§4). |

---

## 4. Background (current state)

- **Vocabulary apps** (Anki, Vocabulary.com, Elevate) are good at spaced recognition but are text-based. The learner never says the word in a sentence.
- **AI speaking tutors** (Speak, Praktika, Talkpal, Duolingo Video Call) give real conversation, but vocabulary is incidental. Speak's Phrasebook saves phrases that "never reintegrate into chats or new lessons." Only ISSEN has cross-session memory with conversation-anchored SRS, and even there review happens on flashcards.
- **General assistants** (ChatGPT/Gemini voice) can quiz on request but have no curriculum, scheduling, or progress tracking.
- **Common learner frustrations:** being cut off while thinking, wrong usage passing as correct, repetitive conversations, and the tutor forgetting them between sessions.

## 5. Desired state

A learner opens a link, talks for ~5 minutes, and leaves having:
1. Met 3 new words in context (heard the pronunciation, understood the meaning).
2. **Used each word themselves** in a spoken sentence the agent confirmed as correct, with hints instead of answers when they got stuck.
3. Seen a recap of what they own and what's coming back.
4. On their next visit, been naturally asked to use yesterday's words again, before any new words.

## 6. Relevance (cost of not solving)

- **Learner:** effort without results. Words studied but not usable → low confidence in interviews, exams, and meetings.
- **Product:** vocabulary is where speaking apps are weakest (§3 of research). A loop that visibly moves words into use is a clear, demo-able difference.
- **Evaluator of this prototype:** a generic "voice chatbot that defines words" would look like every existing app. The prototype needs a clear point of view.

---

## 7. Jobs to Be Done

**Primary job**
> When I **come across a useful word I understand but would never think to say**, but **flashcards don't make me use it and nobody checks whether I'm using it right**, help me **practice saying it in real sentences with instant, honest feedback**, so I can **use it naturally when it matters: in an interview, a meeting, or an exam.**

**Supporting jobs**
- When I **have a few spare minutes (commuting, walking)**, but **can't look at a screen or type**, help me **review words hands-free by talking**, so I can **keep improving without setting aside study time.**
- When I **meet new words in my own life (a report, a show, a meeting)**, but **generic word lists don't include them**, help me **turn *my* words into practice**, so I can **learn vocabulary that's relevant to me.**
- When I **freeze while trying to recall a word**, but **the app either interrupts me or just gives me the answer**, help me **get just enough of a hint to recall it myself**, so I can **build real recall and confidence.**

---

## 8. Personas

### Focal persona: "Priya, the interview-ready professional"
```text
Persona / role:      24-year-old software engineer; English is her second language (B2)
Segment & priority:  FOCAL. Intermediate adult learner with a concrete speaking goal
Context & trigger:   Upcoming job interviews / client calls; notices she repeats simple
                     words ("good", "big", "do") and sounds less precise than she is
Primary job:         Turn words she already recognizes into words she uses when speaking
Key pains:           Flashcards feel useless for speaking; speaking apps cut her off
                     while she thinks; no one tells her if "I mitigated the meeting"
                     is wrong
Current workaround:  Notes app list of words + occasional ChatGPT "quiz me" chats;
                     forgets to review
Product relationship: Mobile/laptop browser, earphones, 5–10 min gaps; comfortable
                     with apps, low patience for signups
Evidence/confidence: Medium. Based on desk research of learner complaints; NOT yet
                     validated with interviews. Last updated 2026-09-17
```

### Secondary persona: "Arjun, the exam crammer"
```text
Persona / role:      20-year-old student preparing for IELTS/GRE
Segment & priority:  SECONDARY. Same loop, higher-difficulty word bank
Context & trigger:   Exam date in 6–8 weeks; speaking band score depends on lexical range
Primary job:         Show a wider vocabulary range under time pressure
Key pains:           Knows word lists by heart for reading, but blanks while speaking
Current workaround:  Word lists, YouTube, Anki
Evidence/confidence: Low–medium. Desk research only
```

### Explicitly out of scope (for the MVP)
- Absolute beginners (A0–A1): they need guided curriculum and native-language scaffolding.
- Children under 13: needs different safety, consent, and content design.
- Learners of languages other than English.
- Pronunciation-perfection seekers (served well by ELSA).

---

## 9. Outcome → Problem → Solution chain

| Layer | Statement |
|---|---|
| **Outcome** | Learners **correctly use** target words in speech, unprompted, in a *later* session. |
| **Problem** | Words stay receptive because (1) no tool asks for productive retrieval in speech, (2) usage isn't honestly verified, and (3) words don't return at spaced intervals inside conversation. |
| **Solution (hypothesis)** | A voice agent that runs a **Learn → Use → Verify → Return** loop: teach in context, set a short spoken mission that makes the learner produce the word, check correctness (code + model), and schedule the word back into future conversations. |

### Solution principles (the criteria for judging ideas)
1. **The learner says the word before the agent does** (productive retrieval over exposure).
2. **Hints before answers** (a hint ladder, not reveal-on-first-miss).
3. **Honest over flattering.** Wrong usage is gently corrected and never counted as success.
4. **The learner sets the pace.** Never cut off someone who's thinking.
5. **Review happens in conversation, not on flashcards.**
6. **Code owns progress; the LLM owns conversation.** Scores and schedules are never left to model memory.
7. **Zero friction to start.** One link, one tap to allow the mic, no account.

---

## 10. Proposed differentiators (from research §5.2)

| ID | Feature | MVP? |
|---|---|---|
| D1 | Use-It Missions (productive-retrieval role-plays) | **Yes, core** |
| D3 | Patient turn-taking (low-eagerness VAD, "give me a second") | **Yes, core** |
| D4 | Hint ladder | **Yes, core** |
| D5 | Honest usage verification (code check + model judgment) | **Yes, core** |
| D2 | Spaced repetition woven into conversation | **Yes** (local, per device) |
| D8 | Cumulative recap card | **Yes** |
| D6 | Bring Your Own Words | Stretch (Phase 4) |
| D7 | Mastery = used correctly in 2+ spaced sessions | Yes (as a display rule) |

---

## 11. Scope

### In scope (prototype)
- Browser-based voice conversation (desktop Chrome/Edge/Safari; mobile Chrome/Safari).
- English vocabulary, three levels (Intermediate / Upper-intermediate / Advanced), curated word bank (~60–150 words).
- Learn → Use → Verify → Return loop with a hint ladder.
- Live transcript + current word card + session recap.
- Progress stored locally on the device; due words resurface next visit.
- Public shareable URL.

### Out of scope (prototype)
- User accounts, cross-device sync, payments.
- Phoneme-level pronunciation scoring.
- Native mobile apps, phone-call channel.
- Multiple target languages, native-language explanations (maybe later).
- Teacher/parent dashboards.

### Constraints
- Build time is short: the priority is a working link over breadth.
- Per-minute voice API cost → session length cap and abuse protection on a public link.
- Browser mic permission and autoplay rules (especially iOS Safari).
- LLM limitations: hallucinated definitions, non-deterministic judgments, no memory across sessions by default. Mitigated with a curated word bank, code-owned state, and evals.

---

## 12. Hypotheses (to validate with the prototype)

| # | We believe… | …will result in… | …for… | Measured by | Target | Level of analysis |
|---|---|---|---|---|---|---|
| H1 | Missions that make learners produce the word | higher later recall than definition + example alone | intermediate learners | % of words used correctly on the first review attempt (next session) | ≥ 60% | Value proposition |
| H2 | Low-eagerness turn detection + "give me a second" | fewer interruptions of learners mid-thought | all users | Interruptions per session (manual transcript review) | ≤ 1 per 5-min session | Design |
| H3 | A hint ladder | more successful self-retrievals vs. reveals | all users | % of stuck moments resolved at hint levels 1–2 | ≥ 50% | Feature |
| H4 | The model can avoid saying the target word first | intact retrieval opportunities | system | "Leak rate": missions where the agent said the word before the learner | ≤ 5% | Feasibility |
| H5 | Usage verification is trustworthy | learners accept feedback as fair | all users | Agreement between agent verdict and human rater on a 50-utterance set | ≥ 85% | Feasibility |
| H6 | Conversation-based review is engaging | learners start a second session | testers | % of testers who return within 72h | ≥ 30% | Value |
| H7 | A no-signup link | fast time-to-first-word | first-time users | Median time from page load to first spoken word taught | ≤ 45 s | Usability |

Record each as **True / Plausible / False** with evidence after testing.

---

## 13. Success metrics (KPI tree)

```
North Star: Words OWNED per active learner per week
  (owned = used correctly, unprompted, in ≥ 2 spaced sessions)
│
├── Words introduced per session            (lever: pacing, session length)
│     └── Sessions per learner per week     (lever: return hook, recap, due-word reminder)
│
├── Productive success rate                 (lever: mission design, hint ladder)
│     = words used correctly in-session ÷ words introduced
│
└── Retention across spacing                (lever: SRS intervals, conversational review)
      = words used correctly at review ÷ words due for review
```

**Guardrail metrics** (so we don't optimize the wrong thing):
- Verification false-positive rate (wrong usage marked correct) ≤ 10%
- Agent leak rate ≤ 5%
- Session abandonment in the first 60 s ≤ 25%
- Median agent response latency ≤ 1.2 s
- Cost per session ≤ a defined cap (e.g., 10-minute hard limit)

**Prototype-stage metrics** (small-sample, 5–10 testers): time-to-first-word, productive success rate, leak rate, verification agreement, qualitative "did this feel different from other apps?"

---

## 14. Definition of done (does the prototype fit this problem?)

The prototype solves the stated problem if a first-time user, using only a shared link, can:
- [ ] Start talking within 45 seconds without signing up.
- [ ] Learn at least 3 words in context, hearing each word pronounced.
- [ ] Be asked to **use** each word in their own spoken sentence, without the agent saying it first.
- [ ] Get stuck and receive a hint (not the answer), then succeed.
- [ ] Make a usage mistake and get a correction, and that attempt is **not** counted as mastered.
- [ ] Pause for several seconds mid-sentence without being cut off.
- [ ] See a recap of words and statuses at the end.
- [ ] Return later on the same device and be asked to use the previous session's words again.

---

## 15. Open questions / risks

1. **Unvalidated persona:** no user interviews yet. Plan 5 quick tester sessions before and after Phase 2.
2. **Judgment reliability:** will usage verification hold up for subtle collocation errors ("make a decision" vs. "do a decision")?
3. **Accents:** recognition of the target word across accents (Indian, Nigerian, Chinese-accented English, etc.).
4. **Cost on a public link:** abuse or long sessions → need rate limits and caps.
5. **Word bank vs. BYOW:** do learners value curated words or their own words more? (Test in Phase 4.)
