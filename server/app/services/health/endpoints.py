"""Endpoint inventory — cached after first openapi generation to keep health fast."""

_ENDPOINTS_CACHE: list[dict] | None = None


def collect_endpoints(app) -> list[dict]:
    global _ENDPOINTS_CACHE
    if _ENDPOINTS_CACHE is not None:
        return _ENDPOINTS_CACHE
    endpoints: list[dict] = []
    try:
        if app is not None:
            try:
                spec = app.openapi()
                for path, methods in spec.get("paths", {}).items():
                    for method, meta in methods.items():
                        if method.startswith("x-"):
                            continue
                        endpoints.append(
                            {
                                "path": path,
                                "methods": [method.upper()],
                                "tag": (meta.get("tags") or [None])[0],
                            }
                        )
                ws_known = [
                    ("/ws/calls", "calls"),
                    ("/ws/whatsapp", "WhatsApp integration"),
                    ("/ws/twilio-relay", "calls"),
                ]
                seen_paths = {e["path"] for e in endpoints}
                for ws_path, tag in ws_known:
                    if ws_path not in seen_paths:
                        endpoints.append({"path": ws_path, "methods": ["WS"], "tag": tag})
                endpoints.sort(key=lambda e: (e["path"], e["methods"]))
                _ENDPOINTS_CACHE = endpoints
                return endpoints
            except Exception:
                pass
        for route in getattr(app, "routes", []) if app else []:
            path = getattr(route, "path", None)
            methods = getattr(route, "methods", None)
            if not path:
                continue
            if methods is None:
                methods = ["WS"] if "WebSocket" in type(route).__name__ else []
            else:
                methods = sorted(methods)
            tag = None
            if hasattr(route, "tags") and route.tags:
                tag = route.tags[0]
            endpoints.append({"path": path, "methods": methods, "tag": tag})
    except Exception:
        pass
    endpoints.sort(key=lambda e: e["path"])
    return endpoints
