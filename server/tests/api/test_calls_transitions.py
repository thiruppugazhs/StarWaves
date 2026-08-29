"""Terminal call-status transition guard tests — missed-vs-accept race."""

import unittest
from unittest.mock import MagicMock

from app.repositories.calls import TERMINAL_STATUSES, CallRepository


def _repo_with_call(current_status):
    database = MagicMock()
    collection = database.collection.return_value
    doc = collection.document.return_value
    snapshot = MagicMock()
    snapshot.exists = True
    snapshot.to_dict.return_value = {
        "caller": {"uid": "a", "name": "A", "email": ""},
        "callee": {"uid": "b", "name": "B", "email": ""},
        "participants": ["a", "b"],
        "status": current_status,
        "messages": [],
    }
    doc.get.return_value = snapshot

    repo = CallRepository(database)
    # get() re-reads; keep returning the same status so guard result is visible.
    return repo, doc


class TestTerminalStatusGuard(unittest.TestCase):
    def test_terminal_statuses_constant_complete(self):
        self.assertEqual(TERMINAL_STATUSES, {"declined", "ended", "missed"})

    def test_missed_rejects_late_accept(self):
        """Stale-ring expirer marked missed exactly as callee accepts — accept loses."""
        repo, doc = _repo_with_call("missed")
        result = repo.update_status("call-1", "active")
        doc.update.assert_not_called()
        self.assertEqual(result["status"], "missed")

    def test_ended_rejects_any_transition(self):
        repo, doc = _repo_with_call("ended")
        for next_status in ("ringing", "active", "declined", "missed"):
            result = repo.update_status("call-1", next_status)
            self.assertEqual(result["status"], "ended")
        doc.update.assert_not_called()

    def test_declined_is_final(self):
        repo, doc = _repo_with_call("declined")
        result = repo.update_status("call-1", "active")
        doc.update.assert_not_called()
        self.assertEqual(result["status"], "declined")

    def test_same_terminal_status_is_idempotent_write_allowed(self):
        """Rewriting identical terminal status (e.g. duplicate callbacks) still writes."""
        repo, doc = _repo_with_call("missed")
        repo.update_status("call-1", "missed")
        doc.update.assert_called_once()

    def test_live_states_still_transition(self):
        repo, doc = _repo_with_call("ringing")
        result = repo.update_status("call-1", "active")
        doc.update.assert_called_once()
        self.assertEqual(result["status"], "ringing")  # mock re-reads same snapshot
        self.assertEqual(doc.update.call_args.args[0]["status"], "active")


if __name__ == "__main__":
    unittest.main()
