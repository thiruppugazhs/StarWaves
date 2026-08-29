"""Tests for the modularized app.db.sql package and app.db.compat compatibility layer."""

import unittest
from datetime import datetime, timezone

from app.db.compat import (
    SERVER_TIMESTAMP as COMPAT_SERVER_TIMESTAMP,
    ArrayUnion as CompatArrayUnion,
    SqlClient as CompatSqlClient,
    get_db_client as compat_get_db_client,
    get_firestore as compat_get_firestore,
)
from app.db.sql import (
    SERVER_TIMESTAMP,
    ArrayUnion,
    SqlBatch,
    SqlClient,
    SqlCollectionRef,
    SqlDocRef,
    SqlQuery,
    SqlSnapshot,
    get_db_client,
    get_firestore,
    is_array_union,
    is_server_timestamp,
    utc_now_iso,
)
from app.db.sql._shared import clean_data, coerce_model_value, json_safe


class TestSqlCompatModule(unittest.TestCase):
    def setUp(self):
        self.client = SqlClient()

    def test_shared_helpers(self):
        # Server timestamp detection
        self.assertTrue(is_server_timestamp(SERVER_TIMESTAMP))
        self.assertTrue(is_server_timestamp("__SQL_SERVER_TIMESTAMP__extra"))
        self.assertFalse(is_server_timestamp("normal_string"))
        self.assertFalse(is_server_timestamp(None))

        # ArrayUnion
        au = ArrayUnion(["tag1", "tag2"])
        self.assertTrue(is_array_union(au))
        self.assertFalse(is_array_union(["tag1"]))

        # Model value coercion
        now = datetime.now(timezone.utc)
        iso_str = now.isoformat()
        coerced = coerce_model_value("created_at", iso_str)
        self.assertIsInstance(coerced, datetime)

        # JSON safe
        safe_data = json_safe({"dt": now, "nested": [now, {"time": now}]})
        self.assertIsInstance(safe_data["dt"], str)
        self.assertIsInstance(safe_data["nested"][0], str)

        # Clean data
        cleaned = clean_data({"ts": SERVER_TIMESTAMP, "arr": au, "normal": 123})
        self.assertIsInstance(cleaned["ts"], str)
        self.assertEqual(cleaned["arr"], ["tag1", "tag2"])
        self.assertEqual(cleaned["normal"], 123)

    def test_query_and_snapshot_primitives(self):
        snap = SqlSnapshot("doc1", {"key": "value"}, exists=True)
        self.assertEqual(snap.id, "doc1")
        self.assertTrue(snap.exists)
        self.assertEqual(snap.to_dict(), {"key": "value"})

        coll = self.client.collection("test_col")
        self.assertIsInstance(coll, SqlCollectionRef)
        doc = coll.document("doc1")
        self.assertIsInstance(doc, SqlDocRef)
        self.assertEqual(doc.reference, doc)

        query = coll.where("status", "==", "active").order_by("created_at", "desc").limit(5)
        self.assertIsInstance(query, SqlQuery)
        self.assertEqual(len(query.filters), 1)
        self.assertEqual(query._order_by, "created_at")
        self.assertEqual(query._direction, "DESC")
        self.assertEqual(query._limit, 5)

    def test_in_memory_fallback_crud(self):
        coll = self.client.collection("mock_custom_collection")
        doc = coll.document("mock_id_1")

        # Set
        doc.set({"name": "Test Mock", "count": 10})
        snap = doc.get()
        self.assertTrue(snap.exists)
        self.assertEqual(snap.to_dict()["name"], "Test Mock")
        self.assertEqual(snap.to_dict()["count"], 10)

        # Update
        doc.update({"count": 20})
        snap = doc.get()
        self.assertEqual(snap.to_dict()["count"], 20)

        # Query
        results = coll.where("name", "==", "Test Mock").stream()
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].id, "mock_id_1")

        # Delete
        doc.delete()
        snap = doc.get()
        self.assertFalse(snap.exists)

    def test_batch_operations(self):
        batch = self.client.batch()
        self.assertIsInstance(batch, SqlBatch)

        doc1 = self.client.collection("batch_test").document("b1")
        doc2 = self.client.collection("batch_test").document("b2")

        batch.set(doc1, {"val": 1})
        batch.set(doc2, {"val": 2})
        batch.commit()

        self.assertTrue(doc1.get().exists)
        self.assertTrue(doc2.get().exists)

        # Batch update & delete
        batch2 = self.client.batch()
        batch2.update(doc1, {"val": 10})
        batch2.delete(doc2)
        batch2.commit()

        self.assertEqual(doc1.get().to_dict()["val"], 10)
        self.assertFalse(doc2.get().exists)

    def test_backward_compat_facade(self):
        # Verify app.db.compat exports identical symbols and functions
        self.assertEqual(COMPAT_SERVER_TIMESTAMP, SERVER_TIMESTAMP)
        self.assertIs(compat_get_db_client, get_db_client)
        self.assertIs(compat_get_firestore, get_firestore)

        client1 = get_db_client()
        client2 = get_firestore()
        client3 = compat_get_firestore()
        self.assertIs(client1, client2)
        self.assertIs(client1, client3)


if __name__ == "__main__":
    unittest.main()
