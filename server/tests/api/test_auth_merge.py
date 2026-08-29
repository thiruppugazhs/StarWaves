import unittest
from unittest.mock import MagicMock

from app.repositories.users import (
    create_user_with_password,
    get_or_create_google_user,
    merge_duplicate_user_accounts,
)


class FakeDoc:
    def __init__(self, doc_id, data):
        self.id = doc_id
        self._data = dict(data)
        self.exists = True

    def to_dict(self):
        return self._data


class TestAuthMerge(unittest.TestCase):
    def setUp(self):
        self.mock_db = MagicMock()
        self.mock_coll = MagicMock()
        self.mock_db.collection.return_value = self.mock_coll

    def test_create_user_with_password_attaches_password_to_google_account(self):
        google_user_data = {
            "email": "user@example.com",
            "display_name": "Google User",
            "google_auth": True,
            "picture": "https://example.com/pic.jpg",
        }
        mock_doc = FakeDoc("google-uid-123", google_user_data)
        self.mock_coll.where.return_value.stream.return_value = [mock_doc]

        mock_doc_ref = MagicMock()
        mock_doc_ref.get.return_value = mock_doc
        self.mock_coll.document.return_value = mock_doc_ref

        result = create_user_with_password(self.mock_db, "user@example.com", "securepassword123")

        self.assertEqual(result["uid"], "google-uid-123")
        self.assertIn("password_hash", result)
        self.assertIn("password_salt", result)
        self.assertEqual(self.mock_coll.document.call_args[0][0], "google-uid-123")

    def test_get_or_create_google_user_links_existing_password_account(self):
        password_user_data = {
            "email": "user@example.com",
            "display_name": "Password User",
            "password_hash": "hash123",
            "password_salt": "salt123",
        }
        mock_doc = FakeDoc("pwd-uid-456", password_user_data)
        self.mock_coll.where.return_value.stream.return_value = [mock_doc]

        mock_doc_ref = MagicMock()
        mock_doc_ref.get.return_value = mock_doc
        self.mock_coll.document.return_value = mock_doc_ref

        result = get_or_create_google_user(self.mock_db, "user@example.com", name="Google Name")

        self.assertEqual(result["uid"], "pwd-uid-456")
        self.assertTrue(result.get("google_auth"))
        self.assertEqual(result["password_hash"], "hash123")

    def test_merge_duplicate_user_accounts_consolidates_records(self):
        doc1 = FakeDoc("uid-1", {"email": "duplicate@example.com", "google_auth": True, "picture": "pic.jpg"})
        doc2 = FakeDoc("uid-2", {"email": "duplicate@example.com", "password_hash": "hash", "password_salt": "salt"})

        self.mock_coll.stream.return_value = [doc1, doc2]

        doc_ref_1 = MagicMock()
        doc_ref_2 = MagicMock()

        def get_doc_ref(doc_id):
            if doc_id == "uid-1":
                return doc_ref_1
            return doc_ref_2

        self.mock_coll.document.side_effect = get_doc_ref

        merged = merge_duplicate_user_accounts(self.mock_db, "duplicate@example.com")

        self.assertEqual(len(merged), 1)
        primary = merged[0]
        self.assertEqual(primary["uid"], "uid-2")
        self.assertTrue(primary.get("google_auth"))
        self.assertEqual(primary["picture"], "pic.jpg")
        doc_ref_1.delete.assert_called_once()


if __name__ == "__main__":
    unittest.main()
