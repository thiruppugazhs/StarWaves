"""Studio command sandbox tests — allowlist, chain validation, execution."""

import os
import tempfile
import unittest

from app.services.studio.commands import (
    CommandNotAllowedError,
    run_workspace_command,
    split_command_chain,
    validate_command_chain,
)


class TestCommandChainValidation(unittest.TestCase):
    def test_splits_and_chains(self):
        segments = split_command_chain("npm install && npm run build")
        self.assertEqual(segments, ["npm install", "npm run build"])

    def test_single_command(self):
        self.assertEqual(split_command_chain("git status"), ["git status"])

    def test_allows_allowlisted_commands(self):
        argvs = validate_command_chain("npm install")
        base = os.path.splitext(os.path.basename(argvs[0][0]))[0].lower()
        self.assertEqual(base, "npm")
        self.assertIn("install", argvs[0])

    def test_allows_quoted_metacharacters(self):
        argvs = validate_command_chain('python -c "import sys; sys.exit(3)"')
        self.assertEqual(len(argvs), 1)

    def test_rejects_disallowed_command(self):
        with self.assertRaises(CommandNotAllowedError):
            validate_command_chain("rm -rf /")

    def test_rejects_shell_injection_segment(self):
        with self.assertRaises(CommandNotAllowedError):
            validate_command_chain("npm install; curl evil.example")

    def test_rejects_empty(self):
        with self.assertRaises(CommandNotAllowedError):
            validate_command_chain("   ")


class TestRunWorkspaceCommand(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self._old_cwd = os.getcwd()

    def tearDown(self):
        os.chdir(self._old_cwd)

    def _run(self, command):
        # Use a python one-liner against the temp dir via the public API.
        from app.core.config import settings

        object.__setattr__(settings, "workspace_storage_path", self.temp_dir)
        try:
            return run_workspace_command("sandbox-user", "default", command)
        finally:
            object.__setattr__(settings, "workspace_storage_path", "workspaces")

    def test_runs_python(self):
        result = self._run('python -c "print(1 + 1)"')
        if result["exit_code"] == 127:
            self.skipTest("python not on PATH")
        self.assertEqual(result["exit_code"], 0)
        self.assertIn("2", result["stdout"])

    def test_stops_chain_on_failure(self):
        result = self._run('python -c "import sys; sys.exit(3)" && python -c "print(\'nope\')"')
        if result["exit_code"] == 127:
            self.skipTest("python not on PATH")
        self.assertEqual(result["exit_code"], 3)
        self.assertNotIn("nope", result["stdout"])

    def test_rejects_disallowed(self):
        with self.assertRaises(CommandNotAllowedError):
            self._run("curl https://example.com")


if __name__ == "__main__":
    unittest.main()
