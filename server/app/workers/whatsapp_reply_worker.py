"""Standalone worker daemon for WhatsApp automated replies via Redis queue."""

import asyncio
import json
import logging
import os
import signal
import sys
import time

logger = logging.getLogger("whatsapp_reply_worker")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

QUEUE_KEY = "starwaves:whatsapp:incoming_events"


async def main_worker_loop():
    from app.core.config import settings
    from app.db import get_firestore
    from app.services.whatsapp_autoreply.engine import WhatsAppAutoReplyEngine

    redis_url = getattr(settings, "redis_url", None) or os.getenv("REDIS_URL") or "redis://localhost:6379/0"

    logger.info("Starting WhatsApp Auto-Reply Worker...")
    logger.info("Connecting to Redis at %s", redis_url)

    import redis.asyncio as aioredis

    client = None
    while client is None:
        try:
            client = aioredis.from_url(redis_url, decode_responses=True)
            await client.ping()
            logger.info("Connected to Redis successfully. Listening on queue '%s'...", QUEUE_KEY)
        except Exception as exc:
            logger.warning("Redis connection failed (%s), retrying in 3s...", exc)
            await asyncio.sleep(3.0)

    stop_event = asyncio.Event()

    def _sig_handler():
        logger.info("Shutdown signal received. Stopping worker gracefully...")
        stop_event.set()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, _sig_handler)
        except NotImplementedError:
            # Signal handlers not fully supported on Windows event loops
            pass

    database = get_firestore()

    while not stop_event.is_set():
        try:
            # Blocking pop with 2 second timeout so we can check stop_event
            result = await client.brpop(QUEUE_KEY, timeout=2.0)
            if not result:
                continue

            _, raw_payload = result
            try:
                payload = json.loads(raw_payload)
            except Exception as parse_err:
                logger.error("Failed to parse queue payload as JSON: %s (raw: %s)", parse_err, raw_payload)
                continue

            logger.info("Processing WhatsApp event for user %s, chat %s", payload.get("user_id"), payload.get("chat_id"))
            res = await WhatsAppAutoReplyEngine.process_incoming_message(database, payload)
            logger.info("Finished processing event: %s", res)

        except asyncio.CancelledError:
            break
        except Exception as loop_err:
            logger.exception("Error in worker loop: %s", loop_err)
            await asyncio.sleep(1.0)

    try:
        await client.aclose()
    except Exception:
        pass
    logger.info("WhatsApp Auto-Reply Worker terminated.")


if __name__ == "__main__":
    try:
        asyncio.run(main_worker_loop())
    except (KeyboardInterrupt, SystemExit):
        logger.info("Worker stopped.")
