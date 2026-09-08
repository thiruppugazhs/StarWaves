"""Call repository: WebRTC call records and signaling against Firestore.

Call documents are shared between exactly two participants, so they live in a
top-level ``calls`` collection (not under a single user). Signaling is
exchanged by appending short messages to the ``messages`` array on the call
document; both participants poll ``GET /calls/{call_id}`` for new messages.
"""

import uuid
from datetime import datetime, timedelta, timezone

from app.db import ArrayUnion, Query, SERVER_TIMESTAMP, SqlClient

from app.schemas.call import CallUser

CALL_STATUSES = {"ringing", "active", "declined", "ended", "missed"}
# Terminal states may not transition again — prevents the missed-vs-accept
# race where the stale-ring expirer marks missed exactly as the callee accepts.
TERMINAL_STATUSES = {"declined", "ended", "missed"}
SIGNAL_TYPES = {"offer", "answer", "ice-candidate"}
MAX_SIGNAL_MESSAGES = 200
MISSED_AFTER = timedelta(seconds=45)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class CallRepository:
    def __init__(self, database: SqlClient):
        self.database = database
        self.collection = database.collection("calls")

    def _document(self, call_id: str):
        return self.collection.document(call_id)

    def create(self, caller: CallUser, callee: CallUser, mode: str, provider: str = "in_app", phone_number: str | None = None, external_sid: str | None = None) -> dict:
        call_id = uuid.uuid4().hex
        data = {
            "caller": caller.model_dump(),
            "callee": callee.model_dump(),
            "participants": [caller.uid, callee.uid],
            "mode": mode,
            "status": "ringing",
            "provider": provider,
            "phone_number": phone_number,
            "external_sid": external_sid,
            "messages": [],
            "created_at": _now_iso(),
            "updated_at": _now_iso(),
        }
        self._document(call_id).set(data)
        return {**data, "id": call_id}

    def set_external_sid(self, call_id: str, sid: str) -> None:
        self._document(call_id).update({"external_sid": sid, "updated_at": _now_iso()})

    def set_phone_number(self, call_id: str, phone: str) -> None:
        self._document(call_id).update({"phone_number": phone, "updated_at": _now_iso()})

    def append_message(self, call_id: str, message: dict) -> None:
        """Append an arbitrary message (e.g. Twilio Say prompt) to the call."""
        self._document(call_id).update({"messages": ArrayUnion([message]), "updated_at": _now_iso()})
        self.prune_messages(call_id)

    def get(self, call_id: str) -> dict | None:
        doc = self._document(call_id).get()
        if not doc.exists:
            return None
        data = doc.to_dict()
        data["id"] = doc.id
        return data

    def append_signal(
        self,
        call_id: str,
        from_uid: str,
        signal_type: str,
        payload: str,
    ) -> dict | None:
        if signal_type not in SIGNAL_TYPES:
            raise ValueError(f"Unknown signal type '{signal_type}'.")
        reference = self._document(call_id)
        if not reference.get().exists:
            return None
        message = {
            "id": uuid.uuid4().hex,
            "from_uid": from_uid,
            "type": signal_type,
            "payload": payload,
            "created_at": _now_iso(),
        }
        reference.update(
            {
                "messages": ArrayUnion([message]),
                "updated_at": _now_iso(),
            },
        )
        self.prune_messages(call_id)
        return message

    def prune_messages(self, call_id: str) -> None:
        """Drop the oldest signaling messages so the array stays bounded."""
        reference = self._document(call_id)
        snapshot = reference.get()
        if not snapshot.exists:
            return
        messages = snapshot.to_dict().get("messages") or []
        if len(messages) <= MAX_SIGNAL_MESSAGES:
            return
        reference.update(
            {
                "messages": messages[-MAX_SIGNAL_MESSAGES:],
                "updated_at": _now_iso(),
            },
        )

    def expire_stale_ringing(self, uid: str) -> None:
        """Server-side guard: auto-miss ringing calls a responder never picked up."""
        threshold = datetime.now(timezone.utc) - MISSED_AFTER
        for call in self._calls_for_user(uid, 50):
            if call.get("status") != "ringing":
                continue
            updated = call.get("updated_at") or call.get("created_at") or ""
            try:
                updated_dt = datetime.fromisoformat(updated)
                if updated_dt.tzinfo is None:
                    updated_dt = updated_dt.replace(tzinfo=timezone.utc)
            except (TypeError, ValueError):
                updated_dt = datetime.now(timezone.utc)
            if updated_dt < threshold:
                reference = self._document(call["id"])
                reference.update(
                    {
                        "status": "missed",
                        "updated_at": _now_iso(),
                    },
                )
                try:
                    from app.services.notifications import send_call_notification
                    callee_uid = call.get("callee", {}).get("uid")
                    caller_name = call.get("caller", {}).get("name", "Someone")
                    mode = call.get("mode", "call")
                    if callee_uid:
                        send_call_notification(
                            database=self.database,
                            target_user_id=callee_uid,
                            title="Missed Call",
                            message=f"Missed {mode} call from {caller_name}",
                            notification_type="call_missed",
                            call_id=call["id"],
                        )
                except Exception:
                    pass

    def update_status(self, call_id: str, status: str) -> dict | None:
        if status not in CALL_STATUSES:
            raise ValueError(f"Unknown call status '{status}'.")
        reference = self._document(call_id)
        snapshot = reference.get()
        if not snapshot.exists:
            return None
        current = (snapshot.to_dict() or {}).get("status")
        if current in TERMINAL_STATUSES and current != status:
            # Terminal states are final — ignore racing transitions.
            return self.get(call_id)
        reference.update({"status": status, "updated_at": _now_iso()})
        return self.get(call_id)

    def list_recent(self, uid: str, limit: int) -> list[dict]:
        calls = self._calls_for_user(uid, limit * 2)
        calls.sort(key=lambda call: call.get("updated_at") or "", reverse=True)
        return calls[:limit]

    def list_incoming(self, uid: str, limit: int = 10) -> list[dict]:
        calls = []
        for call in self._calls_for_user(uid, limit * 3):
            if call.get("status") == "ringing" and call.get("callee", {}).get("uid") == uid:
                calls.append(call)
        calls.sort(key=lambda call: call.get("updated_at") or "", reverse=True)
        return calls[:limit]

    def _calls_for_user(self, uid: str, limit: int) -> list[dict]:
        docs = self.collection.where(
            "participants",
            "array_contains",
            uid,
        ).limit(limit).stream()
        calls = []
        for doc in docs:
            data = doc.to_dict()
            data["id"] = doc.id
            calls.append(data)
        return calls