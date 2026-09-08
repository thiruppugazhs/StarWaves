"""Eve Avatar Studio handlers; these emit frontend actions, never mutate scenes."""

_COMMANDS = {"select_node", "update_transform", "set_material", "add_keyframe", "save", "playback", "export_glb"}
_CONFIRMATION_COMMANDS = {"update_transform", "set_material", "add_keyframe", "save", "export_glb"}


def handle_avatar_editor_action(database, user_id: str, arguments: dict):
    command = arguments.get("command")
    if command not in _COMMANDS:
        return {"error": "Unsupported Avatar Studio editor action."}, None, None

    action = {key: value for key, value in arguments.items() if value is not None}
    action["type"] = "avatar_editor_action"
    action["requires_confirmation"] = command in _CONFIRMATION_COMMANDS
    return {"action": action}, None, action
