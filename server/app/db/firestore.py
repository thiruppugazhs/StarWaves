import logging
import os
from functools import lru_cache
from typing import Any

import firebase_admin
from firebase_admin import credentials, firestore

from app.core.config import settings

logger = logging.getLogger(__name__)


def get_firebase_app() -> firebase_admin.App | None:
    try:
        return firebase_admin.get_app()
    except ValueError:
        pass

    # Check for direct service account environment credentials
    if settings.firebase_client_email and settings.firebase_private_key:
        try:
            private_key = settings.firebase_private_key.replace("\\n", "\n")
            cred_dict = {
                "type": settings.firebase_type,
                "project_id": settings.firebase_project_id,
                "private_key_id": settings.firebase_private_key_id,
                "private_key": private_key,
                "client_email": settings.firebase_client_email,
                "client_id": settings.firebase_client_id,
                "auth_uri": settings.firebase_auth_uri,
                "token_uri": settings.firebase_token_uri,
                "auth_provider_x509_cert_url": settings.firebase_auth_provider_cert_url,
                "client_x509_cert_url": settings.firebase_client_cert_url,
            }
            cred = credentials.Certificate(cred_dict)
            logger.info("Initializing Firebase Admin SDK with environment service account")
            return firebase_admin.initialize_app(cred)
        except Exception as exc:
            logger.warning("Could not initialize Firebase with env credentials: %s", exc)

    # Check for service account file on disk
    g_creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    if g_creds_path:
        resolved_path = g_creds_path
        if not os.path.exists(resolved_path):
            # Check relative to server root
            candidate = Path(__file__).resolve().parent.parent.parent / g_creds_path
            if candidate.exists():
                resolved_path = str(candidate)

        if os.path.exists(resolved_path):
            try:
                cred = credentials.Certificate(resolved_path)
                logger.info("Initializing Firebase Admin SDK with credentials file: %s", resolved_path)
                return firebase_admin.initialize_app(cred)
            except Exception as exc:
                logger.warning("Could not initialize Firebase with creds file: %s", exc)

    # Check project ID fallback
    if settings.firebase_project_id:
        try:
            options = {"projectId": settings.firebase_project_id}
            logger.info("Initializing Firebase Admin SDK with project ID: %s", settings.firebase_project_id)
            return firebase_admin.initialize_app(options=options)
        except Exception as exc:
            logger.warning("Could not initialize Firebase with project ID: %s", exc)

    return None


@lru_cache(maxsize=1)
def get_firestore_client() -> Any:
    """Return the active database client.

    Uses Google Cloud Firestore via Firebase Admin SDK when credentials are
    present. Falls back to SqlClient (SQLite/PostgreSQL) when offline or
    unconfigured.
    """
    app = get_firebase_app()
    if app:
        try:
            database_id = settings.firestore_database_id or "(default)"
            client = firestore.client(app=app, database_id=database_id)
            logger.info("Connected to Google Cloud Firestore (database: %s)", database_id)
            return client
        except Exception as exc:
            logger.warning("Firebase app exists but Firestore client failed: %s. Using SqlClient.", exc)

    from app.db.sql.client import get_db_client
    return get_db_client()
