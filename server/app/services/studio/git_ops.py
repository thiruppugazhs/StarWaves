"""Studio git operations — single responsibility: local git init/status/commit/remote/push."""

import os
import subprocess

from app.services.studio.constants import GIT_AUTHOR_EMAIL, GIT_AUTHOR_NAME
from app.services.studio.templates import ensure_gitignore
from app.repositories.workspace_files import _workspace_root

_GIT_TIMEOUT = 60


class GitUnavailableError(RuntimeError):
    """Raised when the git binary is missing or a git operation fails."""


def _run_git(user_id: str, workspace_id: str, *args: str, check: bool = True) -> subprocess.CompletedProcess:
    root = _workspace_root(user_id, workspace_id)
    try:
        result = subprocess.run(
            ["git", *args],
            cwd=root,
            capture_output=True,
            text=True,
            timeout=_GIT_TIMEOUT,
        )
    except FileNotFoundError as error:
        raise GitUnavailableError("git is not installed on the server.") from error
    except subprocess.TimeoutExpired as error:
        raise GitUnavailableError(f"git {args[0]} timed out.") from error
    if check and result.returncode != 0:
        detail = (result.stderr or result.stdout or "").strip()
        raise GitUnavailableError(f"git {args[0]} failed: {detail[:300]}")
    return result


def is_available() -> bool:
    try:
        subprocess.run(["git", "--version"], capture_output=True, timeout=10)
        return True
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def ensure_initialized(user_id: str, workspace_id: str) -> bool:
    """Init repo + identity + main branch + .gitignore. Returns True when initialized."""
    if not is_available():
        return False
    _run_git(user_id, workspace_id, "init", "-b", "main", check=False)
    _run_git(
        user_id,
        workspace_id,
        "config",
        "user.name",
        GIT_AUTHOR_NAME,
        check=False,
    )
    _run_git(
        user_id,
        workspace_id,
        "config",
        "user.email",
        GIT_AUTHOR_EMAIL,
        check=False,
    )
    ensure_gitignore(user_id, workspace_id)
    return True


def status(user_id: str, workspace_id: str) -> dict:
    """Porcelain status summary: branch, changed files, remote."""
    root = _workspace_root(user_id, workspace_id)
    initialized = os.path.isdir(os.path.join(root, ".git"))
    if not initialized:
        return {"initialized": False, "branch": None, "changed_files": [], "ahead": 0, "remote_url": None}

    branch = None
    branch_result = _run_git(user_id, workspace_id, "rev-parse", "--abbrev-ref", "HEAD", check=False)
    if branch_result.returncode == 0:
        branch = branch_result.stdout.strip() or None

    changed = []
    status_result = _run_git(user_id, workspace_id, "status", "--porcelain", check=False)
    if status_result.returncode == 0:
        changed = [line[3:].strip() for line in status_result.stdout.splitlines() if line.strip()]

    ahead = 0
    ahead_result = _run_git(
        user_id, workspace_id, "rev-list", "--count", "@{upstream}..HEAD", check=False
    )
    if ahead_result.returncode == 0 and ahead_result.stdout.strip().isdigit():
        ahead = int(ahead_result.stdout.strip())

    remote_url = None
    remote_result = _run_git(user_id, workspace_id, "remote", "get-url", "origin", check=False)
    if remote_result.returncode == 0:
        remote_url = remote_result.stdout.strip() or None

    return {
        "initialized": True,
        "branch": branch,
        "changed_files": changed[:100],
        "ahead": ahead,
        "remote_url": remote_url,
    }


def commit_all(user_id: str, workspace_id: str, message: str) -> dict:
    """Stage every change and commit. Returns commit summary."""
    ensure_initialized(user_id, workspace_id)
    _run_git(user_id, workspace_id, "add", "-A")
    result = _run_git(user_id, workspace_id, "commit", "-m", message, check=False)
    if result.returncode == 0:
        return {"committed": True, "detail": result.stdout.strip()[:200]}
    if "nothing to commit" in (result.stdout or ""):
        return {"committed": False, "detail": "Nothing to commit — working tree clean."}
    raise GitUnavailableError(f"git commit failed: {(result.stderr or '').strip()[:300]}")


def set_remote(user_id: str, workspace_id: str, repo_url: str) -> None:
    """Point origin at the given repository URL."""
    existing = _run_git(user_id, workspace_id, "remote", "get-url", "origin", check=False)
    if existing.returncode == 0:
        _run_git(user_id, workspace_id, "remote", "set-url", "origin", repo_url)
    else:
        _run_git(user_id, workspace_id, "remote", "add", "origin", repo_url)


def push(user_id: str, workspace_id: str, token: str | None = None) -> dict:
    """Push current branch to origin. Injects the OAuth token into the https URL when given."""
    remote_result = _run_git(user_id, workspace_id, "remote", "get-url", "origin", check=False)
    if remote_result.returncode != 0:
        raise GitUnavailableError("No GitHub repository connected for this project.")

    push_args = ["push", "-u", "origin", "HEAD"]
    if token and remote_result.stdout.strip().startswith("https://github.com/"):
        authed_url = remote_result.stdout.strip().replace(
            "https://github.com/", f"https://x-access-token:{token}@github.com/"
        )
        push_args = ["push", "-u", authed_url, "HEAD"]

    result = _run_git(user_id, workspace_id, *push_args, check=False)
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "").strip()
        # Never leak the injected token in errors.
        if token:
            detail = detail.replace(f"x-access-token:{token}@", "")
        raise GitUnavailableError(f"git push failed: {detail[:400]}")
    return {"pushed": True, "detail": result.stdout.strip()[-200:] or "Pushed to origin."}
