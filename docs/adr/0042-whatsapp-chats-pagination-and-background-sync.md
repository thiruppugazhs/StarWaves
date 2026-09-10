# 0042. WhatsApp Chats Endpoint Cursor-Based Pagination & Async Sync

Date: 2026-09-10
Status: Accepted

## Context

The WhatsApp conversations listing endpoint (`GET /api/v1/whatsapp/chats`) previously queried and returned all stored chat records in one batch without pagination. In addition, `WhatsAppService.list_chats` performed a synchronous blocking round-trip to the whatsmeow gateway worker on every chat list request to upsert new conversations.

This caused:
1. Significant latency on chat retrieval (over 14 seconds in production on accounts with extensive conversation history).
2. Large payload transfer size (>1.1 MB transferred over HTTP on initial page load).
3. Blocking the web client from rendering the WhatsApp interface quickly.

## Decision

1. **Cursor-Based Endpoint Pagination**:
   - `GET /api/v1/whatsapp/chats` accepts `limit: int = 30` (range: 1-100) and `cursor: Optional[str] = None`.
   - Returns a structured envelope `WhatsAppChatListResponse(items: List[WhatsAppChatResponse], next_cursor: Optional[str], has_more: bool)`.
   - The repository query utilizes the existing `SqlQuery.order_by("updated_at", direction=Query.DESCENDING).limit(limit + 1)` and `start_after(cursor)` capabilities.

2. **Non-Blocking Background Worker Sync**:
   - Upstream WhatsApp worker chat sync is moved to a background task (`asyncio.create_task(WhatsAppService._sync_worker_chats_background(...))`) triggered on initial page load (`cursor is None`), avoiding blocking the initial HTTP response.
   - New chats and messages continue to be broadcast over WebSockets (`chats_synced` event) to keep the client list real-time.

3. **Frontend Infinite Scroll**:
   - `WhatsAppChatList` attaches an onScroll listener that fires `onLoadMoreChats` when the user scrolls near the bottom of the list.
   - `WhatsAppPage` manages `nextChatsCursor`, `hasMoreChats`, and appends deduplicated new chat items smoothly.

## Consequences

- **Performance**: Endpoint response latency dropped from ~14s down to under 300ms, and initial transfer size dropped from 1.14 MB to ~30-50 KB.
- **Client Experience**: Instant conversational list display on load with progressive loading when scrolling down.
