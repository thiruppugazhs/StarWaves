# TTS / STT Provider Comparison

Comparing speech providers for a voice agent, standardized to **minutes of speech
per month** where possible.

> **Assumption (TTS):** ~1,000 characters ≈ 1 minute of spoken English.

| Provider                          |    STT free/month |           TTS free/month | Standardized     |
| --------------------------------- | ----------------: | -----------------------: | ---------------- |
| **OpenRouter — Fish S2.1 Pro Free** |                 — | **200 req/day free***  | ⭐⭐⭐⭐             |
| **Google Cloud**                  |        **60 min** | **4M chars ≈ 4,000 min** | ⭐⭐⭐⭐⭐            |
| **ElevenLabs**                    |        **10 min** |   **10K chars ≈ 10 min** | ⭐⭐⭐              |
| **AWS Transcribe**                |       **60 min*** |                        — | ⭐⭐⭐              |
| **AssemblyAI**                    |   **$50 credits** |                        — | Depends on usage |
| **Groq Whisper**                  | **~480 min/day*** |                        — | ⭐⭐⭐⭐⭐            |
| **Murf API**                      |                 — | **100K chars ≈ 100 min** | ⭐⭐⭐⭐             |
| **Kokoro local**                  |                 — |            **Unlimited** | ♾️               |
| **Whisper local**                 |     **Unlimited** |                        — | ♾️               |
| **Piper local**                   |                 — |            **Unlimited** | ♾️               |

## Simplified ranking

### STT — minutes/month

- 🥇 **Groq:** ~14,400 min/month*
- 🥈 **Google:** 60 min/month
- 🥈 **AWS:** 60 min/month*
- **ElevenLabs:** ~10 min/month
- **Whisper local:** ♾️

### TTS — minutes/month

- 🥇 **Kokoro:** ♾️
- 🥇 **Piper:** ♾️
- 🥈 **Google Standard:** ~4,000 min/month
- 🥉 **Murf:** ~100 min
- **ElevenLabs:** ~10 min
- **Fish S2.1 Pro Free (via OpenRouter):** 200 req/day (free tier, no SLA; free through Aug 31 2026 per Fish Audio)

> **Important:** Groq's limit is a **rate limit, not a guaranteed monthly
> allowance**, Fish S2.1 Pro Free is rate-limited at 200 req/day and has no
> uptime/TTFA guarantees, and AWS's 60-minute offer is for the **first 12
> months**. Don't treat those as guaranteed monthly quotas.

### Fish S2.1 Pro Free via OpenRouter (StarWaves)

- **Model:** `fish-audio/s2.1-pro-free:free` at `https://openrouter.ai/api/v1/audio/speech` (OpenAI-compatible, `response_format: mp3`).
- **Env:** `OPENROUTER_API_KEY` (required), `OPENROUTER_TTS_MODEL` (default `fish-audio/s2.1-pro-free:free`), `OPENROUTER_TTS_VOICE` (default `alloy`), optional `OPENROUTER_TTS_URL`.
- **Selection:** Settings → Eve voice → `OpenRouter — Fish S2.1 Pro Free` saves `tts_provider="openrouter"` to `users/{uid}/settings/eve-speech`; falls back to browser when no key.

If the goal is a **voice agent with 100–500 users**, compare **free minutes ×
requests/day × concurrent users** instead — character quotas alone can be
misleading.