"""Eve Studio tool definitions — single responsibility: builder domain."""

STUDIO_TOOLS = [
    {
        "type": "function",
        "name": "create_studio_project",
        "description": (
            "Create a new Studio project (an isolated workspace for one app/website). "
            "Optionally scaffold a curated template. Returns the project id used by all "
            "other Studio tools."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "minLength": 1},
                "description": {"type": "string"},
                "template_id": {
                    "type": "string",
                    "description": (
                        "One of: react-vite, static-site, react-saas, fastapi-api, "
                        "node-express-api, fullstack-react-fastapi. Omit for a blank project."
                    ),
                },
                "stack": {"type": "string"},
                "db_preference": {
                    "type": "string",
                    "enum": ["sqlite", "postgres", "supabase", "mongodb", "none"],
                },
                "auth_enabled": {"type": "boolean"},
            },
            "required": ["name"],
            "additionalProperties": False,
        },
        "strict": False,
    },
    {
        "type": "function",
        "name": "list_studio_projects",
        "description": "List the user's Studio projects with their build status and metadata.",
        "parameters": {
            "type": "object",
            "properties": {},
            "required": [],
            "additionalProperties": False,
        },
        "strict": True,
    },
    {
        "type": "function",
        "name": "get_studio_project",
        "description": (
            "Get one Studio project's details: metadata, pending build plan and its "
            "approval status, git state, and file count."
        ),
        "parameters": {
            "type": "object",
            "properties": {"workspace_id": {"type": "string", "minLength": 1}},
            "required": ["workspace_id"],
            "additionalProperties": False,
        },
        "strict": True,
    },
    {
        "type": "function",
        "name": "submit_build_plan",
        "description": (
            "Submit a structured build plan for a Studio project BEFORE writing any code. "
            "The plan is shown to the user as an approval card; they must approve it in the "
            "UI before you may start building. Include every file you intend to create with "
            "a one-line purpose each."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "workspace_id": {"type": "string", "minLength": 1},
                "title": {"type": "string", "minLength": 1},
                "summary": {"type": "string"},
                "stack": {"type": "string"},
                "db_preference": {
                    "type": "string",
                    "enum": ["sqlite", "postgres", "supabase", "mongodb", "none"],
                },
                "needs_auth": {"type": "boolean"},
                "files": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "path": {"type": "string", "minLength": 1},
                            "purpose": {"type": "string"},
                        },
                        "required": ["path"],
                        "additionalProperties": False,
                    },
                },
            },
            "required": ["workspace_id", "title"],
            "additionalProperties": False,
        },
        "strict": False,
    },
    {
        "type": "function",
        "name": "write_studio_files",
        "description": (
            "Write a batch of files into a Studio project (build phase). Max 50 files per "
            "call; split larger builds across multiple calls. Only call this after the plan "
            "is approved (plan_status === 'approved')."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "workspace_id": {"type": "string", "minLength": 1},
                "files": {
                    "type": "array",
                    "minItems": 1,
                    "maxItems": 50,
                    "items": {
                        "type": "object",
                        "properties": {
                            "path": {"type": "string", "minLength": 1},
                            "content": {"type": "string"},
                        },
                        "required": ["path", "content"],
                        "additionalProperties": False,
                    },
                },
            },
            "required": ["workspace_id", "files"],
            "additionalProperties": False,
        },
        "strict": True,
    },
    {
        "type": "function",
        "name": "run_studio_command",
        "description": (
            "Run an allowlisted command (npm, npx, pnpm, yarn, node, git, python, pip) "
            "inside a Studio workspace. Chains with && are supported. Use for installs, "
            "builds, tests, and git commits. Timeout up to 600s."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "workspace_id": {"type": "string", "minLength": 1},
                "command": {"type": "string", "minLength": 1},
                "timeout_seconds": {"type": "integer", "minimum": 5, "maximum": 600},
            },
            "required": ["workspace_id", "command"],
            "additionalProperties": False,
        },
        "strict": False,
    },
    {
        "type": "function",
        "name": "publish_studio_template",
        "description": (
            "Publish an existing Studio project as a personal reusable template that can "
            "be remixed into new projects."
        ),
        "parameters": {
            "type": "object",
            "properties": {"workspace_id": {"type": "string", "minLength": 1}},
            "required": ["workspace_id"],
            "additionalProperties": False,
        },
        "strict": True,
    },
]
