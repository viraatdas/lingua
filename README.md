# lingua

Speak Spanish and Mandarin out loud, every day. Live voice conversations over the OpenAI Realtime API, spaced repetition for travel phrases, and pronunciation grading from actual audio.

Live at https://lingua.viraat.dev

## What it does

- **Talk**: WebRTC voice conversations with a tutor that roleplays travel situations (café, restaurant, directions, taxi, hotel, market, pharmacy, meeting someone), discusses today's news, or just chats. The tutor stays at your CEFR level, recasts mistakes, and saves new words to your deck via a tool call. Ending a call produces written feedback, corrections, and phrases to add.
- **Review**: SM-2 spaced repetition over ~120 seed phrases per language plus anything you add. Optional "say it out loud" mode grades your pronunciation and suggests a rating.
- **Pronounce**: pick any phrase (or type one), hear it, record yourself, and get a 0-100 score with per-syllable issues. Mandarin grading is tone-aware.
- **News**: three stories from the last 48 hours in the target language, written at your level with key vocabulary, fetched with web search.
- **Progress**: streak, deck state, activity strip, level and daily-limit settings. All progress lives in `localStorage`.

## Stack

Next.js 16 (App Router), React 19, Tailwind 4, OpenAI SDK.

| Feature | Model |
| --- | --- |
| Conversation | `gpt-realtime-2.1` (WebRTC, ephemeral client secrets) |
| Turn transcription | `gpt-4o-mini-transcribe` |
| Pronunciation grading | `gpt-audio-1.5` (audio in, JSON out) |
| News, feedback | `gpt-5.4-mini` (+ `web_search` for news) |
| Phrase audio | `gpt-4o-mini-tts` |

Override with `REALTIME_MODEL`, `AUDIO_MODEL`, `TEXT_MODEL`.

## Run it

```
pnpm install
echo "OPENAI_API_KEY=sk-..." > .env.local
pnpm dev
```

## Layout

```
src/app/            pages: / (today), /review, /talk, /talk/[id], /pronounce, /progress
src/app/api/        realtime/session, news, pronounce, tts, feedback
src/lib/decks/      seed phrases (es.ts, zh.ts)
src/lib/scenarios.ts  roleplay definitions
src/lib/prompts.ts    tutor, grader, news and feedback prompts
src/lib/srs.ts        scheduler
src/lib/store.tsx     localStorage-backed store + derived queues/stats
src/lib/realtime.ts   WebRTC client
```
