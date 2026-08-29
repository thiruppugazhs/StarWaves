"""Studio sandboxed command runner — single responsibility: allowlisted shell execution."""

import os
import shlex
import shutil
import subprocess

from app.repositories.workspace_files import _workspace_root
from app.services.studio.constants import (
    ALLOWED_COMMAND_BASENAMES,
    DEFAULT_COMMAND_TIMEOUT_SECONDS,
    MAX_COMMAND_TIMEOUT_SECONDS,
)

_OUTPUT_CAP_CHARS = 20_000
_MAX_CHAINED_COMMANDS = 8

# Shell metacharacters rejected outright: commands run without a shell, so
# these are either inert or a sign of an injection attempt — refuse both.
_FORBIDDEN_CHARS = frozenset(";|&<>\n\r`")


class CommandNotAllowedError(ValueError):
    """Raised when a command is outside the Studio allowlist."""


def _resolve_executable(base_name: str) -> str | None:
    """Resolve a command basename to its full path (handles npm.cmd on Windows)."""
    return shutil.which(base_name)


def split_command_chain(command: str) -> list[str]:
    """Split a command string on ``&&`` chains into individual segments."""
    segments: list[str] = []
    buffer = ""
    index = 0
    while index < len(command):
        if command.startswith("&&", index):
            segments.append(buffer)
            buffer = ""
            index += 2
            continue
        buffer += command[index]
        index += 1
    segments.append(buffer)
    return [segment.strip() for segment in segments if segment.strip()]


def _find_unquoted_forbidden(command: str) -> list[str]:
    """Return forbidden shell metacharacters appearing outside quotes."""
    found: set[str] = set()
    quote: str | None = None
    for char in command:
        if quote:
            if char == quote:
                quote = None
            continue
        if char in ("'", '"'):
            quote = char
        elif char in _FORBIDDEN_CHARS:
            found.add(char)
    return sorted(found)


def validate_command_chain(command: str) -> list[list[str]]:
    """Validate every chained segment against the allowlist. Returns argv lists."""
    segments = split_command_chain(command)
    if not segments:
        raise CommandNotAllowedError("Empty command.")
    if len(segments) > _MAX_CHAINED_COMMANDS:
        raise CommandNotAllowedError(
            f"Command chains are limited to {_MAX_CHAINED_COMMANDS} segments."
        )

    validated: list[list[str]] = []
    for segment in segments:
        forbidden_found = _find_unquoted_forbidden(segment)
        if forbidden_found:
            raise CommandNotAllowedError(
                "Shell metacharacters not allowed: " + " ".join(forbidden_found)
            )
        try:
            tokens = shlex.split(segment)
        except ValueError as error:
            raise CommandNotAllowedError(f"Could not parse command: {error}") from error
        if not tokens:
            raise CommandNotAllowedError("Empty command segment.")
        base_name = os.path.basename(tokens[0]).lower().strip()
        if base_name not in ALLOWED_COMMAND_BASENAMES:
            raise CommandNotAllowedError(
                f"'{tokens[0]}' is not allowed. Allowed commands: "
                + ", ".join(sorted(ALLOWED_COMMAND_BASENAMES))
            )
        resolved = _resolve_executable(tokens[0])
        validated.append([resolved or tokens[0], *tokens[1:]])
    return validated


def run_workspace_command(
    user_id: str,
    workspace_id: str,
    command: str,
    timeout_seconds: int = DEFAULT_COMMAND_TIMEOUT_SECONDS,
) -> dict:
    """Run an allowlisted command inside the studio workspace. Never uses a shell.

    Chained segments (``a && b``) run sequentially and stop at the first failure.
    """
    timeout = min(max(timeout_seconds, 5), MAX_COMMAND_TIMEOUT_SECONDS)
    chain = validate_command_chain(command)
    cwd = _workspace_root(user_id, workspace_id)
    os.makedirs(cwd, exist_ok=True)

    stdout_parts: list[str] = []
    stderr_parts: list[str] = []
    timed_out = False
    exit_code = 0

    for argv in chain:
        try:
            # Minimal env — prevent leaking DATABASE_URL / AUTH_SECRET_KEY / etc via python -c
            safe_env = {
                "PATH": os.environ.get("PATH", ""),
                "CI": "1",
                "NO_COLOR": "1",
                "HOME": os.environ.get("HOME", ""),
                "TMPDIR": os.environ.get("TMPDIR", "/tmp"),
                "LANG": os.environ.get("LANG", "C.UTF-8"),
                "NODE_ENV": "development",
            }
            # Block dangerous interpreter escapes: `python -c` / `node -e`
            if os.path.basename(argv[0]).lower() in {"python", "python3", "node"}:
                if any(flag in argv for flag in ("-c", "-e")):
                    raise CommandNotAllowedError("Interpreter -c/-e execution is not allowed.")
            # Prevent npm/pip arbitrary script execution (pip setup.py / npm postinstall)
            base = os.path.basename(argv[0]).lower()
            if base in {"npm", "yarn"} and "--ignore-scripts" not in argv:
                argv = argv + ["--ignore-scripts"]
            elif base in {"pip", "pip3"} and "--no-build-isolation" not in argv:
                # Force no build isolation to reduce arbitrary code, require --ignore-scripts equivalent
                if "--ignore-scripts" not in argv and "install" in argv:
                    argv = argv + ["--no-build-isolation"]
            elif base in {"npx", "pnpm"} and "--ignore-scripts" not in argv and "--no-scripts" not in argv:
                argv = argv + ["--ignore-scripts"]
            result = subprocess.run(
                argv,
                cwd=cwd,
                capture_output=True,
                text=True,
                timeout=timeout,
                env=safe_env,
            )
        except subprocess.TimeoutExpired as error:
            timed_out = True
            exit_code = 124
            stdout_parts.append(error.stdout or "" if isinstance(error.stdout, str) else "")
            stderr_parts.append(error.stderr or "" if isinstance(error.stderr, str) else "")
            stderr_parts.append(f"\n[Timed out after {timeout}s]")
            break
        except OSError as error:
            exit_code = 127
            stderr_parts.append(f"[Failed to start {argv[0]}: {error}]")
            break
        stdout_parts.append(result.stdout or "")
        stderr_parts.append(result.stderr or "")
        exit_code = result.returncode
        if result.returncode != 0:
            break

    return {
        "command": command,
        "exit_code": exit_code,
        "stdout": "".join(stdout_parts)[:_OUTPUT_CAP_CHARS],
        "stderr": "".join(stderr_parts)[:_OUTPUT_CAP_CHARS],
        "timed_out": timed_out,
    }
