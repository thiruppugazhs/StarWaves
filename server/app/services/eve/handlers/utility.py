"""Utility handlers — single responsibility: QR, chart, PDF, and OCR operations."""

from app.db import SqlClient


def handle_generate_qr_code(database: SqlClient, user_id: str, arguments: dict) -> tuple[dict, str, None]:
    from app.services.eve.handlers.artifacts import save_media_file
    from app.services.qr_codes import generate_qr_png

    data = generate_qr_png(arguments["data"])
    path = save_media_file(user_id, "qr", "png", data)
    return {"path": path, "bytes": len(data), "data": arguments["data"]}, "workspace-files", None


def handle_create_chart(database: SqlClient, user_id: str, arguments: dict) -> tuple[dict, str, None]:
    from app.services.charts import render_chart
    from app.services.eve.handlers.artifacts import save_media_file

    data = render_chart(
        arguments["chart_type"],
        arguments["labels"],
        arguments["values"],
        arguments.get("title", ""),
    )
    path = save_media_file(user_id, "chart", "png", data)
    return {"path": path, "bytes": len(data)}, "workspace-files", None


def handle_read_pdf_file(database: SqlClient, user_id: str, arguments: dict) -> tuple[dict, None, None]:
    from app.services.document_reader import extract_pdf_text
    from app.services.source_files import fetch_source_bytes

    data, _ = fetch_source_bytes(user_id, arguments["source"])
    return {"text": extract_pdf_text(data), "source": arguments["source"]}, None, None


def handle_extract_text_from_image(database: SqlClient, user_id: str, arguments: dict) -> tuple[dict, None, None]:
    from app.services.document_reader import extract_image_text
    from app.services.source_files import fetch_source_bytes

    data, mime_type = fetch_source_bytes(user_id, arguments["source"])
    return {"text": extract_image_text(data, mime_type), "source": arguments["source"]}, None, None
