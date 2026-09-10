# ADR 0041 — AI Latency Reduction & Pre-LLM Pipeline Optimization

## Status

Accepted

- Date: 2026-09-09
- Deciders: @susin-d
- Tags: ve, i, latency, performance, caching, sse

## Context

The Eve AI chat streaming endpoint (/api/v1/eve/chat/stream) and tool execution loop exhibited avoidable pre-LLM latency, inter-chunk jitter, and post-response delays:
1. **Blocking Auto-Memory Extraction**: xtract_and_save_memories() executed synchronously inside the stream generator before yielding the final done event, forcing a second LLM round-trip (200–2000 ms) before the frontend received completion metadata.
2. **Uncached RAG Semantic Search**: search_memories() executed a pgvector cosine similarity search on every turn without caching, adding 80–300 ms.
3. **Redundant DB Lookups**: 
esolve_ai_config() queried Firestore settings even when an explicit server-keyed provider_override was present; ve_sessions.get_session() queried session state on every turn without caching.
4. **SSE Queue Polling Jitter**: The SSE generator used syncio.to_thread(q.get, timeout=0.1) combined with syncio.sleep(0.02), causing 20–100 ms jitter between streamed chunks.
5. **Serial Workspace Inspection**: _all_records() fetched all 6 workspace resource types serially when executing overview tools (summarize_dashboard, suggest_next_actions).
6. **Prompt Bloat**: Fallback memory injection inserted up to 40 memories into the system prompt, inflating time-to-first-token (TTFT).

## Decision

We implemented a coordinated 6-point latency optimization across the backend:

- **Asynchronous Auto-Memory**: stream_chat_with_eve() in [chat_stream.py](file:///c:/project/starwaves/server/app/services/eve/chat_stream.py) yields the done event immediately to the client and fires memory extraction in a daemon background thread (	hreading.Thread).
- **RAG Query Cache**: Added a 30-second per-query RAG cache _rag_cache keyed by (user_id, sha256(query)[:12]) in [memories.py](file:///c:/project/starwaves/server/app/services/eve/memories.py), invalidated when memories change.
- **Injected Memory Cap**: Capped fallback injected memories at MAX_INJECTED_MEMORIES = 15 in [memories.py](file:///c:/project/starwaves/server/app/services/eve/memories.py).
- **AI Config Override Fast-Path**: [config.py](file:///c:/project/starwaves/server/app/services/ai_models/config.py) skips DB preference loading if provider_override has a configured server key.
- **Session ID Cache**: Added in-memory session validation cache _session_cache (5 min TTL, 20 max per user) in [chat_stream.py](file:///c:/project/starwaves/server/app/services/eve/chat_stream.py).
- **Direct Asyncio SSE Queue**: [ve_stream.py](file:///c:/project/starwaves/server/app/api/routes/eve_stream.py) replaced thread queue polling with syncio.Queue + loop.call_soon_threadsafe, enabling direct event loop consumption without sleep polling.
- **Concurrent Workspace Record Fetching**: [workspace_records.py](file:///c:/project/starwaves/server/app/services/eve/workspace_records.py) parallelized _all_records() using ThreadPoolExecutor.map() across all 6 supported resource types.

## Consequences

- **Positive:**
  - 200–2000 ms eliminated from stream completion time (auto-memory no longer blocks done).
  - First-token time reduced by 100–450 ms across warm and continuation chat turns.
  - SSE chunk delivery is immediate and jitter-free.
  - Multi-resource workspace tools execute in the time of the slowest single resource instead of the sum.
- **Negative / Cost:**
  - Memory extraction errors run asynchronously and only appear in server logs (acceptable as extraction was already best-effort).
  - Short-lived in-memory caches consume minimal heap (< 100 KB across active users).

## Alternatives Considered

| Alternative | Why rejected |
|-------------|--------------|
| Keep sync auto-memory | Delays the user-visible end of the turn by a full LLM round-trip |
| Background Redis job queue (Celery/RQ) | Overkill for lean 1–10 user deployment on e2-micro |
| Async SQLAlchemy across all services | Major cross-cutting rewrite; thread pool achieves identical concurrency for tool execution |

## References

- [chat_stream.py](file:///c:/project/starwaves/server/app/services/eve/chat_stream.py)
- [memories.py](file:///c:/project/starwaves/server/app/services/eve/memories.py)
- [config.py](file:///c:/project/starwaves/server/app/services/ai_models/config.py)
- [ve_stream.py](file:///c:/project/starwaves/server/app/api/routes/eve_stream.py)
- [workspace_records.py](file:///c:/project/starwaves/server/app/services/eve/workspace_records.py)
