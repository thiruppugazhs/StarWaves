"""Eve avatar service — preferences stored in ui_preferences doc + upload validation."""

import base64
import re
import uuid
import zipfile
from io import BytesIO

from app.db import SqlClient

AVATAR_PREF_KEY = "eve_avatar"
MAX_UPLOAD_BYTES = 12 * 1024 * 1024
MAX_SINGLE_BYTES = 8 * 1024 * 1024
# Mirrors ui_preferences.MAX_HISTORY (kept local: importing ui_preferences here
# would cycle through app.services.eve.handlers.ui depending on import order).
MAX_HISTORY = 20

ALLOWED_EXTS = {".vrm", ".glb", ".gltf", ".zip"}
# model3.json checked via endswith
CATALOG = [
    {"id": "eve-anime-vrm", "label": "Eve Anime (VRM 10MB)", "renderer": "vrm", "url": "/avatars/vrm/eve-anime.vrm", "attribution": "Anime VRM — VRM1 Twist Sample (pixiv/three-vrm) 10.3MB"},
    {"id": "haru-greeter-live2d", "label": "Haru Greeter (Live2D Anime)", "renderer": "live2d", "url": "/avatars/live2d/haru/haru_greeter_t03.model3.json", "attribution": "Haru Greeter — pixi-live2d-display (moc3 0.37MB + 2.7MB textures)"},
]

def _read_ui_raw(database: SqlClient, user_id: str) -> dict:
    ref = database.collection("users").document(user_id).collection("settings").document("ui-preferences")
    snap = ref.get()
    if not snap.exists:
        return {}
    return snap.to_dict() or {}

def _write_ui_raw(database: SqlClient, user_id: str, raw: dict) -> None:
    ref = database.collection("users").document(user_id).collection("settings").document("ui-preferences")
    from app.db import SERVER_TIMESTAMP
    raw["updated_at"] = SERVER_TIMESTAMP
    ref.set(raw, merge=True)

def get_prefs(database: SqlClient, user_id: str) -> dict:
    raw = _read_ui_raw(database, user_id)
    prefs = raw.get(AVATAR_PREF_KEY)
    if not prefs:
        return {"enabled": True, "renderer": "auto", "modelId": "eve-anime-vrm", "modelUrl": None, "scale": 1.0, "zoom": 1.0, "userPan": {"x": 0.0, "y": 0.0}, "autoRotate": False, "position": {"x": 92, "y": 88}, "docked": True, "motion": "auto", "inlineEnabled": True, "orbFallback": True}
    return prefs

def save_prefs(database: SqlClient, user_id: str, patch: dict) -> dict:
    raw = _read_ui_raw(database, user_id)
    current = raw.get(AVATAR_PREF_KEY) or get_prefs(database, user_id)
    # validate fields
    next_prefs = dict(current)
    if "enabled" in patch and patch["enabled"] is not None:
        next_prefs["enabled"] = bool(patch["enabled"])
    if "renderer" in patch and patch["renderer"] is not None:
        if patch["renderer"] not in ("auto", "vrm", "live2d"):
            raise ValueError("renderer must be auto|vrm|live2d")
        next_prefs["renderer"] = patch["renderer"]
    if "modelId" in patch and patch["modelId"] is not None:
        mid = str(patch["modelId"])
        if len(mid) > 120:
            raise ValueError("modelId too long")
        if "<" in mid or ">" in mid:
            raise ValueError("modelId must not contain < or >")
        next_prefs["modelId"] = mid
    if "modelUrl" in patch:
        url = patch["modelUrl"]
        if url is not None:
            url = str(url)
            if len(url) > 1000 or "<" in url or ">" in url:
                raise ValueError("invalid modelUrl")
            if url and not (url.startswith("/") or url.startswith("https://") or url.startswith("http://")):
                raise ValueError("modelUrl must be absolute or root-relative")
            next_prefs["modelUrl"] = url
        else:
            next_prefs["modelUrl"] = None
    if "scale" in patch and patch["scale"] is not None:
        s = float(patch["scale"])
        if s < 0.8 or s > 1.2:
            raise ValueError("scale must be 0.8..1.2")
        next_prefs["scale"] = s
    if "zoom" in patch and patch["zoom"] is not None:
        z = float(patch["zoom"])
        if z < 0.3 or z > 3.0:
            raise ValueError("zoom must be 0.3..3.0")
        next_prefs["zoom"] = z
    if "userPan" in patch and patch["userPan"] is not None:
        pan = patch["userPan"]
        if not isinstance(pan, dict) or "x" not in pan or "y" not in pan:
            raise ValueError("userPan must be {x,y}")
        x = float(pan["x"])
        y = float(pan["y"])
        if not (-1000 <= x <= 1000 and -1000 <= y <= 1000):
            raise ValueError("userPan values must be -1000..1000")
        next_prefs["userPan"] = {"x": x, "y": y}
    if "position" in patch and patch["position"] is not None:
        pos = patch["position"]
        if not isinstance(pos, dict) or "x" not in pos or "y" not in pos:
            raise ValueError("position must be {x,y}")
        next_prefs["position"] = {"x": float(pos["x"]), "y": float(pos["y"])}
    for key in ("docked", "inlineEnabled", "orbFallback", "autoRotate"):
        if key in patch and patch[key] is not None:
            next_prefs[key] = bool(patch[key])
    if "motion" in patch and patch["motion"] is not None:
        if patch["motion"] not in ("auto", "on", "reduced"):
            raise ValueError("motion must be auto|on|reduced")
        next_prefs["motion"] = patch["motion"]
    raw[AVATAR_PREF_KEY] = next_prefs
    # ensure version/history kept by ui_preferences service shape
    if "version" not in raw:
        raw["version"] = 1
    # simple push history for avatar changes
    hist = raw.get("history", [])
    hist.append({"version": raw.get("version", 1), "at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(), "cause": "avatar:prefs", "snapshot": {"eve_avatar": dict(next_prefs)}})
    if len(hist) > MAX_HISTORY:
        hist = hist[-MAX_HISTORY:]
    raw["history"] = hist
    raw["version"] = int(raw.get("version", 1)) + 1
    _write_ui_raw(database, user_id, raw)
    return next_prefs

def list_models(database: SqlClient, user_id: str, limit: int = 20, cursor: str | None = None) -> dict:
    raw = _read_ui_raw(database, user_id)
    uploads = raw.get("eve_avatar_uploads", [])
    combined = list(CATALOG) + uploads
    # cursor is index
    start = 0
    if cursor:
        try:
            start = int(cursor)
        except:
            start = 0
    sliced = combined[start:start + limit + 1]
    has_more = len(sliced) > limit
    if has_more:
        sliced = sliced[:limit]
    next_cursor = str(start + limit) if has_more else None
    return {"models": sliced, "has_more": has_more, "next_cursor": next_cursor}

def _validate_upload(filename: str, data: bytes) -> str:
    if len(data) > MAX_UPLOAD_BYTES:
        raise ValueError("File too large — max 12MB")
    low = filename.lower()
    if low.endswith(".model3.json"):
        if len(data) > MAX_SINGLE_BYTES:
            raise ValueError("model3.json too large")
        # must be json
        try:
            import json
            json.loads(data.decode("utf-8"))
        except Exception:
            raise ValueError("Invalid model3.json — not valid JSON")
        return "live2d"
    if low.endswith(".vrm") or low.endswith(".glb") or low.endswith(".gltf"):
        if len(data) > MAX_SINGLE_BYTES:
            raise ValueError("Model too large — max 8MB for single file")
        if low.endswith(".vrm"):
            if not data.startswith(b"VRM") and not data[:4] == b"glTF":
                # allow glTF-based VRM
                pass
        return "vrm" if low.endswith(".vrm") else "vrm"
    if low.endswith(".zip"):
        try:
            bio = BytesIO(data)
            with zipfile.ZipFile(bio) as zf:
                names = zf.namelist()
                # must contain exactly one .model3.json
                m3 = [n for n in names if n.lower().endswith(".model3.json")]
                if len(m3) != 1:
                    raise ValueError("Zip must contain exactly one .model3.json")
                # traversal guard
                for n in names:
                    if ".." in n or n.startswith("/") or ":\\" in n:
                        raise ValueError("Zip contains unsafe path")
        except zipfile.BadZipFile:
            raise ValueError("Invalid zip file")
        return "live2d"
    raise ValueError("Unsupported file type — use .vrm, .glb, .gltf, .model3.json or .zip")

def save_upload(database: SqlClient, user_id: str, filename: str, data: bytes) -> dict:
    renderer = _validate_upload(filename, data)
    # write to workspace storage (reuse existing path logic)
    import os
    base = os.environ.get("WORKSPACE_STORAGE_PATH", "/tmp/starwaves-workspace")
    # sanitize filename
    safe_name = re.sub(r"[^a-zA-Z0-9._-]", "_", filename.split("/")[-1].split("\\")[-1])[:120]
    uid = uuid.uuid4().hex[:10]
    subdir = os.path.join(base, "avatars", user_id)
    os.makedirs(subdir, exist_ok=True)
    dest = os.path.join(subdir, f"{uid}_{safe_name}")
    # realpath guard
    real_base = os.path.realpath(subdir)
    real_dest = os.path.realpath(dest)
    if not real_dest.startswith(real_base):
        raise ValueError("Invalid destination path")
    with open(dest, "wb") as handle:
        handle.write(data)
    model_id = f"upload:{uid}"
    url = f"/avatars/{user_id}/{uid}_{safe_name}"
    # also store via static /updates alias? For now return url and persist meta
    raw = _read_ui_raw(database, user_id)
    uploads = raw.get("eve_avatar_uploads", [])
    uploads.append({"id": model_id, "label": safe_name, "renderer": renderer, "url": url, "filename": safe_name, "attribution": "Uploaded by user"})
    raw["eve_avatar_uploads"] = uploads[-20:]
    # also set as active
    prefs = raw.get(AVATAR_PREF_KEY) or get_prefs(database, user_id)
    prefs["modelId"] = model_id
    prefs["modelUrl"] = url
    prefs["renderer"] = renderer
    raw[AVATAR_PREF_KEY] = prefs
    if "version" not in raw:
        raw["version"] = 1
    raw["version"] = int(raw["version"]) + 1
    _write_ui_raw(database, user_id, raw)
    return {"preferences": prefs, "model": {"id": model_id, "url": url, "renderer": renderer}}

def delete_upload(database: SqlClient, user_id: str, model_id: str) -> None:
    if not model_id.startswith("upload:"):
        raise ValueError("Only uploaded models can be deleted")
    raw = _read_ui_raw(database, user_id)
    uploads = raw.get("eve_avatar_uploads", [])
    next_uploads = [u for u in uploads if u.get("id") != model_id]
    if len(next_uploads) == len(uploads):
        raise ValueError("Model not found")
    raw["eve_avatar_uploads"] = next_uploads
    prefs = raw.get(AVATAR_PREF_KEY)
    if prefs and prefs.get("modelId") == model_id:
        prefs["modelId"] = "eve-anime-vrm"
        prefs["modelUrl"] = None
        prefs["renderer"] = "auto"
        raw[AVATAR_PREF_KEY] = prefs
    raw["version"] = int(raw.get("version", 1)) + 1
    _write_ui_raw(database, user_id, raw)
    # try delete file
    try:
        import os
        base = os.environ.get("WORKSPACE_STORAGE_PATH", "/tmp/starwaves-workspace")
        # find file by model_id prefix
        subdir = os.path.join(base, "avatars", user_id)
        if os.path.isdir(subdir):
            for fname in os.listdir(subdir):
                if model_id.split(":")[1] in fname:
                    try:
                        os.remove(os.path.join(subdir, fname))
                    except:
                        pass
    except:
        pass
