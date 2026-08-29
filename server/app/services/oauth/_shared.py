"""Provider-agnostic OAuth helpers shared by Google and GitHub integrations."""

import hashlib

import httpx
from fastapi.responses import HTMLResponse
from app.db import SqlClient
from itsdangerous import URLSafeTimedSerializer


def create_oauth_state_serializer(secret: str, salt: str) -> URLSafeTimedSerializer:
    """Build a timed serializer for OAuth ``state`` tokens using the given salt."""
    return URLSafeTimedSerializer(secret, salt=salt)


def format_oauth_error(error: Exception, provider: str = "Google") -> str:
    if isinstance(error, httpx.HTTPStatusError):
        try:
            data = error.response.json()
            desc = data.get("error_description") or data.get("error") or str(error)
            return f"{provider} HTTP {error.response.status_code}: {desc}"
        except Exception:
            return f"{provider} HTTP {error.response.status_code}: {error.response.text[:100]}"
    elif isinstance(error, httpx.HTTPError):
        return f"Network error connecting to {provider}: {error}"
    return str(error) or error.__class__.__name__


def integration_account_id(identifier: str) -> str:
    """Stable Firestore document id for a connected integration account."""
    return hashlib.sha256(identifier.lower().strip().encode()).hexdigest()


def integration_accounts_reference(database: SqlClient, user_id: str, integration_name: str):
    return (
        database.collection("users")
        .document(user_id)
        .collection("integrations")
        .document(integration_name)
        .collection("accounts")
    )


def oauth_callback_html(frontend_url: str, feature: str, error_reason: str | None = None) -> HTMLResponse:
    """HTML close-and-redirect snippet used by OAuth callback routes."""
    import json

    status = "error" if error_reason else "success"
    feature_js = json.dumps(feature)
    status_js = json.dumps(status)
    error_js = json.dumps(error_reason or "")
    origin_js = json.dumps(frontend_url)
    redirect_js = json.dumps(
        f"{frontend_url}/app/setting?{feature}=error&reason={error_reason}"
        if error_reason
        else f"{frontend_url}/app/setting?{feature}=connected"
    )
    html = f"""<!DOCTYPE html>
<html>
<head><title>StarWaves Authentication</title></head>
<body>
<script>
  try {{
    var payload = {{
      type: "STARWAVES_OAUTH_CALLBACK",
      feature: {feature_js},
      status: {status_js},
      error: {error_js}
    }};
    var targetOrigin = {origin_js};
    if (window.opener) {{
      try {{
        window.opener.postMessage(payload, targetOrigin);
      }} catch (err) {{}}
    }}
    if (window.BroadcastChannel) {{
      try {{
        var bc = new BroadcastChannel("starwaves_oauth");
        bc.postMessage(payload);
        bc.close();
      }} catch (err) {{}}
    }}
    try {{
      localStorage.setItem("starwaves_oauth_event", JSON.stringify({{ payload: payload, t: Date.now() }}));
    }} catch (err) {{}}
  }} catch (e) {{}}
  window.close();
  setTimeout(function() {{
    window.location.href = {redirect_js};
  }}, 800);
</script>
</body>
</html>"""
    return HTMLResponse(html)

