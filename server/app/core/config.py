import os
from dataclasses import dataclass

from dotenv import load_dotenv

app_env = os.getenv("APP_ENV", "development").lower()
if app_env == "production" and os.path.exists(".env.prod"):
    load_dotenv(".env.prod", override=True)
elif os.path.exists(".env"):
    load_dotenv(".env", override=True)
else:
    load_dotenv()


@dataclass(frozen=True)
class Settings:
    app_name: str = os.getenv("APP_NAME", "StarWaves API")
    app_env: str = os.getenv("APP_ENV", "development")
    api_v1_prefix: str = os.getenv("API_V1_PREFIX", "/api/v1")
    cors_origins_raw: str = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,https://starwaves.app,https://starwaves.vercel.app",
    )
    firebase_project_id: str | None = os.getenv("FIREBASE_PROJECT_ID")
    firebase_private_key: str | None = os.getenv("FIREBASE_PRIVATE_KEY")
    firebase_client_email: str | None = os.getenv("FIREBASE_CLIENT_EMAIL")
    firebase_private_key_id: str | None = os.getenv("FIREBASE_PRIVATE_KEY_ID")
    firebase_client_id: str | None = os.getenv("FIREBASE_CLIENT_ID")
    firebase_auth_uri: str = os.getenv(
        "FIREBASE_AUTH_URI",
        "https://accounts.google.com/o/oauth2/auth",
    )
    firebase_token_uri: str = os.getenv(
        "FIREBASE_TOKEN_URI",
        "https://oauth2.googleapis.com/token",
    )
    firebase_auth_provider_cert_url: str = os.getenv(
        "FIREBASE_AUTH_PROVIDER_X509_CERT_URL",
        "https://www.googleapis.com/oauth2/v1/certs",
    )
    firebase_client_cert_url: str | None = os.getenv(
        "FIREBASE_CLIENT_X509_CERT_URL",
    )
    firebase_type: str = os.getenv("FIREBASE_TYPE", "service_account")
    github_oauth_client_id: str | None = os.getenv("GITHUB_OAUTH_CLIENT_ID")
    github_oauth_client_secret: str | None = os.getenv("GITHUB_OAUTH_CLIENT_SECRET")
    github_oauth_state_secret: str | None = os.getenv("GITHUB_OAUTH_STATE_SECRET")
    github_oauth_callback_url: str = os.getenv(
        "GITHUB_OAUTH_CALLBACK_URL",
        "http://127.0.0.1:8000/api/v1/integrations/github/callback",
    )
    google_oauth_client_id: str | None = os.getenv("GOOGLE_OAUTH_CLIENT_ID")
    google_oauth_client_secret: str | None = os.getenv("GOOGLE_OAUTH_CLIENT_SECRET")
    google_oauth_state_secret: str | None = os.getenv("GOOGLE_OAUTH_STATE_SECRET")
    google_oauth_callback_url: str = os.getenv(
        "GOOGLE_OAUTH_CALLBACK_URL",
        "http://127.0.0.1:8000/api/v1/integrations/google-calendar/callback",
    )
    google_drive_oauth_callback_url: str = os.getenv(
        "GOOGLE_DRIVE_OAUTH_CALLBACK_URL",
        "http://127.0.0.1:8000/api/v1/integrations/google-drive/callback",
    )
    gmail_oauth_callback_url: str = os.getenv(
        "GMAIL_OAUTH_CALLBACK_URL",
        "http://127.0.0.1:8000/api/v1/integrations/gmail/callback",
    )
    google_chat_oauth_callback_url: str = os.getenv(
        "GOOGLE_CHAT_OAUTH_CALLBACK_URL",
        "http://127.0.0.1:8000/api/v1/integrations/google-chat/callback",
    )
    google_contacts_oauth_callback_url: str = os.getenv(
        "GOOGLE_CONTACTS_OAUTH_CALLBACK_URL",
        "http://127.0.0.1:8000/api/v1/integrations/google-contacts/callback",
    )
    frontend_url: str = os.getenv("FRONTEND_URL", "http://localhost:5173")
    auth_google_callback_url: str = os.getenv(
        "AUTH_GOOGLE_CALLBACK_URL",
        "http://127.0.0.1:8000/api/v1/auth/google/callback",
    )
    auth_secret_key: str = os.getenv("AUTH_SECRET_KEY") or (
        "starwaves-super-secret-auth-key-change-in-prod" if app_env != "production" else ""
    )
    default_ai_provider: str = os.getenv("DEFAULT_AI_PROVIDER", "gemini")
    openai_api_key: str | None = os.getenv("OPENAI_API_KEY")
    openai_url: str | None = os.getenv("OPENAI_URL") or None
    openai_model: str = os.getenv("OPENAI_MODEL", "gpt-5-mini")
    anthropic_api_key: str | None = os.getenv("ANTHROPIC_API_KEY")
    anthropic_url: str | None = os.getenv("ANTHROPIC_URL") or None
    anthropic_model: str = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-5")
    gemini_api_key: str | None = os.getenv("GEMINI_API_KEY")
    gemini_url: str | None = os.getenv("GEMINI_URL") or None
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    groq_api_key: str | None = os.getenv("GROQ_API_KEY")
    groq_url: str | None = os.getenv("GROQ_URL") or None
    groq_model: str = os.getenv("GROQ_MODEL", "llama-3.1-70b-versatile")
    groq_voice_model: str = os.getenv("GROQ_VOICE_MODEL", "llama-3.1-8b-instant")
    groq_stt_model: str = os.getenv("GROQ_STT_MODEL", "whisper-large-v3-turbo")
    deepgram_api_key: str | None = os.getenv("DEEPGRAM_API_KEY")
    deepgram_stt_url: str = os.getenv("DEEPGRAM_STT_URL", "https://api.deepgram.com/v1/listen")
    deepgram_stt_model: str = os.getenv("DEEPGRAM_STT_MODEL", "nova-3")
    openrouter_api_key: str | None = os.getenv("OPENROUTER_API_KEY")
    openrouter_url: str | None = os.getenv("OPENROUTER_URL") or None
    openrouter_model: str = os.getenv("OPENROUTER_MODEL", "openai/gpt-4o")
    ollama_url: str | None = os.getenv("OLLAMA_URL") or None
    ollama_model: str = os.getenv("OLLAMA_MODEL", "llama3.1")
    ollama_api_key: str | None = os.getenv("OLLAMA_API_KEY")
    opencode_api_key: str | None = os.getenv("OPENCODE_API_KEY")
    opencode_url: str | None = os.getenv("OPENCODE_URL") or None
    opencode_model: str = os.getenv("OPENCODE_MODEL", "gpt-5.4-mini")
    google_cloud_tts_api_key: str | None = os.getenv("GOOGLE_CLOUD_TTS_API_KEY")
    google_cloud_tts_url: str | None = os.getenv(
        "GOOGLE_CLOUD_TTS_URL",
        "https://texttospeech.googleapis.com/v1",
    )
    google_cloud_tts_voice: str = os.getenv("GOOGLE_CLOUD_TTS_VOICE", "en-US-Standard-C")
    elevenlabs_api_key: str | None = os.getenv("ELEVENLABS_API_KEY")
    elevenlabs_model_id: str = os.getenv("ELEVENLABS_MODEL_ID", "eleven_turbo_v2_5")
    elevenlabs_voice_id: str = os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")
    openrouter_tts_model: str = os.getenv("OPENROUTER_TTS_MODEL", "fish-audio/s2.1-pro-free:free")
    openrouter_tts_voice: str = os.getenv("OPENROUTER_TTS_VOICE", "alloy")
    openrouter_tts_url: str | None = os.getenv("OPENROUTER_TTS_URL") or None
    firestore_database_id: str = os.getenv(
        "FIRESTORE_DATABASE_ID",
        "(default)",
    )
    database_url: str = os.getenv(
        "DATABASE_URL",
        "sqlite+aiosqlite:///starwaves.db",
    )
    smtp_host: str = os.getenv("SMTP_HOST", "")
    smtp_port: int = int(os.getenv("SMTP_PORT", "587"))
    smtp_user: str | None = os.getenv("SMTP_USER")
    smtp_password: str | None = os.getenv("SMTP_PASSWORD")
    smtp_from_email: str = os.getenv("SMTP_FROM_EMAIL", "noreply@starwaves.app")
    smtp_use_tls: bool = os.getenv("SMTP_USE_TLS", "true").lower() == "true"
    smtp_use_ssl: bool = os.getenv("SMTP_USE_SSL", "false").lower() == "true"
    cron_secret: str | None = os.getenv("CRON_SECRET") or (
        "starwaves-cron-secret" if app_env != "production" else None
    )
    # Unified serverless flag: VERCEL/Lambda auto-detect + explicit IS_SERVERLESS override (see main.py lifespan)
    is_serverless: bool = bool(
        os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME") or os.getenv("IS_SERVERLESS", "false").lower() == "true"
    )
    workspace_storage_path: str = os.getenv("WORKSPACE_STORAGE_PATH", "workspaces")
    redis_url: str | None = os.getenv("REDIS_URL") or None
    studio_preview_domain: str = os.getenv(
        "STUDIO_PREVIEW_DOMAIN",
        "",
    )
    studio_command_timeout: int = int(os.getenv("STUDIO_COMMAND_TIMEOUT", "300"))
    whatsapp_gateway_url: str = os.getenv(
        "WHATSAPP_GATEWAY_URL",
        "http://whatsapp-worker:3001" if os.path.exists("/.dockerenv") else "http://127.0.0.1:3001",
    )
    whatsapp_eve_tag: str = os.getenv("WHATSAPP_EVE_TAG", "@assistant")
    whatsapp_owner_name: str = os.getenv("WHATSAPP_OWNER_NAME", "User")
    whatsapp_owner_aliases_raw: str = os.getenv("WHATSAPP_OWNER_ALIASES", "@me,@user")
    whatsapp_my_number: str = os.getenv("WHATSAPP_MY_NUMBER", "")
    whatsapp_my_jid: str = os.getenv("WHATSAPP_MY_JID", "")
    whatsapp_worker_secret: str | None = os.getenv("WHATSAPP_WORKER_SECRET")

    # Twilio PSTN provider (dual call option: in-app WebRTC vs PSTN)
    twilio_account_sid: str | None = os.getenv("TWILIO_ACCOUNT_SID")
    twilio_auth_token: str | None = os.getenv("TWILIO_AUTH_TOKEN")
    twilio_phone_number: str | None = os.getenv("TWILIO_PHONE_NUMBER")
    twilio_callback_base_url: str = os.getenv(
        "TWILIO_CALLBACK_BASE_URL",
        os.getenv("API_BASE_URL", "http://127.0.0.1:8000"),
    )
    twilio_enabled: bool = bool(os.getenv("TWILIO_ACCOUNT_SID") and os.getenv("TWILIO_AUTH_TOKEN") and os.getenv("TWILIO_PHONE_NUMBER"))

    @property
    def whatsapp_owner_aliases(self) -> list[str]:
        raw = self.whatsapp_owner_aliases_raw or ""
        return [a.strip() for a in raw.split(",") if a.strip()]

    @property
    def cors_origins(self) -> list[str]:
        raw = os.getenv("CORS_ORIGINS") or self.cors_origins_raw or ""
        return [
            origin.strip()
            for origin in raw.split(",")
            if origin.strip()
        ]


settings = Settings()
