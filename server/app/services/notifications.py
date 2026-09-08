import logging
import firebase_admin
from firebase_admin import messaging

logger = logging.getLogger(__name__)

# Token rejection codes that mean the device token is no longer valid.
PRUNABLE_CODES = {"UNREGISTERED", "INVALID_ARGUMENT", "NOT_FOUND", "MISMATCH_SENDER_ID"}


def _get_fcm_app() -> firebase_admin.App | None:
    try:
        return firebase_admin.get_app()
    except Exception:
        return None


def send_push_notification(
    device_token: str,
    title: str,
    body: str,
    data: dict[str, str] | None = None,
) -> str:
    app = _get_fcm_app()
    if not app:
        logger.debug("Firebase messaging app not initialized; skipping push notification.")
        return ""
    message = messaging.Message(
        notification=messaging.Notification(
            title=title,
            body=body,
        ),
        data=data or {},
        token=device_token,
    )
    response = messaging.send(message, app=app)
    logger.info("Successfully sent GCM push notification ID: %s", response)
    return response


def incomplete_tokens(device_tokens: list[str], batch_response) -> list[str]:
    """Return the device tokens that FCM rejected as permanently invalid."""
    invalid = []
    for index, result in enumerate(batch_response.responses):
        if index >= len(device_tokens):
            break
        if result.exception and result.exception.code in PRUNABLE_CODES:
            invalid.append(device_tokens[index])
    return invalid


def send_multicast_notification(
    device_tokens: list[str],
    title: str,
    body: str,
    data: dict[str, str] | None = None,
) -> dict:
    if not device_tokens:
        return {"success_count": 0, "failure_count": 0, "invalid_tokens": []}

    app = _get_fcm_app()
    if not app:
        logger.debug("Firebase messaging app not initialized; skipping push notification.")
        return {"success_count": 0, "failure_count": 0, "invalid_tokens": []}
    message = messaging.MulticastMessage(
        notification=messaging.Notification(
            title=title,
            body=body,
        ),
        data=data or {},
        tokens=device_tokens,
    )
    batch_response = messaging.send_each_for_multicast(message, app=app)
    invalid_tokens = incomplete_tokens(device_tokens, batch_response)
    logger.info(
        "GCM multicast sent: %d succeeded, %d failed",
        batch_response.success_count,
        batch_response.failure_count,
    )
    return {
        "success_count": batch_response.success_count,
        "failure_count": batch_response.failure_count,
        "invalid_tokens": invalid_tokens,
    }


def send_call_notification(
    database,
    target_user_id: str,
    title: str,
    message: str,
    notification_type: str = "call_incoming",
    call_id: str | None = None,
) -> dict:
    """Store workspace notification and attempt FCM push to registered user devices."""
    created = None
    try:
        from app.repositories.notifications import NotificationRepository
        repo = NotificationRepository(database, target_user_id)
        created = repo.create(type=notification_type, title=title, message=message)
    except Exception as exc:
        logger.warning("Could not persist workspace notification for user %s: %s", target_user_id, exc)

    push_result = None
    try:
        docs = list(database.collection("users").document(target_user_id).collection("devices").stream())
        tokens = [doc.to_dict().get("token") for doc in docs if doc.to_dict().get("token")]
        if tokens:
            data = {"type": notification_type}
            if call_id:
                data["call_id"] = call_id
            push_result = send_multicast_notification(
                device_tokens=tokens,
                title=title,
                body=message,
                data=data,
            )
    except Exception as exc:
        logger.info("Push notification not dispatched for call (%s): %s", notification_type, exc)

    return {"notification": created, "push_result": push_result}

