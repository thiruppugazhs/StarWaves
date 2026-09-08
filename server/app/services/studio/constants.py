"""Studio service constants — single responsibility: limits, allowlists, preview config."""

from app.core.config import settings

# Commands Eve/the user may run inside a Studio workspace (argv[0] basename).
ALLOWED_COMMAND_BASENAMES = frozenset(
    {
        "npm",
        "npx",
        "pnpm",
        "yarn",
        "node",
        "git",
        "python",
        "python3",
        "pip",
        "pip3",
    }
)

DEFAULT_COMMAND_TIMEOUT_SECONDS = 300
MAX_COMMAND_TIMEOUT_SECONDS = 600

# Batch file writes per request (mirrors workspace-files sync cap for e2-micro).
MAX_BATCH_FILES = 50
MAX_BATCH_TOTAL_BYTES = 10 * 1024 * 1024
MAX_FILE_CONTENT_BYTES = 2 * 1024 * 1024

# Signed preview tokens stay valid for one week; regenerate on demand.
PREVIEW_TOKEN_MAX_AGE_SECONDS = 7 * 24 * 3600
PREVIEW_TOKEN_SALT = "studio-preview"

GIT_AUTHOR_NAME = "StarWaves Studio"
GIT_AUTHOR_EMAIL = "studio@starwaves.susindran.in"

# Build output directories checked in order when serving previews.
PREVIEW_BUILD_DIRS = ("dist", "build", "out", "public")
PREVIEW_ENTRY_FILE = "index.html"


def studio_preview_domain() -> str:
    """Optional wildcard domain for {token}.build previews (empty = path URLs only)."""
    return getattr(settings, "studio_preview_domain", "") or ""
