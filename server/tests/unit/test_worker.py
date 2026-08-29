import unittest
from unittest.mock import MagicMock

from app.core.worker import ServerBackgroundWorker


class TestServerBackgroundWorker(unittest.TestCase):
    def test_worker_start_and_stop(self):
        worker = ServerBackgroundWorker(interval_seconds=1)
        worker.start()
        self.assertTrue(worker._thread.is_alive())
        worker.stop(timeout=2.0)
        self.assertFalse(worker._thread.is_alive())

    def test_worker_tick_runs_without_exception(self):
        worker = ServerBackgroundWorker(interval_seconds=1)
        worker.database = MagicMock()
        # Mock list_all_due_schedules to return empty list
        with unittest.mock.patch("app.core.worker.list_all_due_schedules", return_value=[]):
            worker.tick()
