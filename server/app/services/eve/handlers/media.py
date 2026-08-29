"""Media handlers — single responsibility: image/video generation and audio conversion."""

from app.db import SqlClient


def handle_generate_image(database: SqlClient, user_id: str, arguments: dict) -> tuple[dict, str, None]:
    from app.services.eve.handlers.artifacts import save_media_file
    from app.services.media_generation import generate_image

    data = generate_image(arguments["prompt"], arguments.get("size", "1024x1024"))
    path = save_media_file(user_id, "image", "png", data)
    return {"path": path, "bytes": len(data), "generated": True}, "workspace-files", None


def handle_generate_video(database: SqlClient, user_id: str, arguments: dict) -> tuple[dict, str, None]:
    from app.services.eve.handlers.artifacts import save_media_file
    from app.services.media_generation import generate_video

    data = generate_video(arguments["prompt"])
    path = save_media_file(user_id, "video", "mp4", data)
    return {"path": path, "bytes": len(data), "generated": True}, "workspace-files", None


def handle_text_to_speech(database: SqlClient, user_id: str, arguments: dict) -> tuple[dict, str, None]:
    from app.services.eve.handlers.artifacts import save_media_file
    from app.services.media_generation import synthesize_audio

    audio, media_type = synthesize_audio(database, user_id, arguments["text"])
    extension = "mp3" if "mpeg" in media_type else "wav"
    path = save_media_file(user_id, "speech", extension, audio)
    return {"path": path, "bytes": len(audio), "media_type": media_type}, "workspace-files", None


def handle_speech_to_text(database: SqlClient, user_id: str, arguments: dict) -> tuple[dict, None, None]:
    from app.services.media_generation import transcribe_audio

    text = transcribe_audio(database, user_id, arguments["source"])
    return {"text": text, "source": arguments["source"]}, None, None
