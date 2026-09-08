# ADR 0040 — Avatar Studio Eve editor actions

## Status

Accepted

- Date: 2026-09-07
- Deciders: Starwaves maintainers
- Tags: `eve`, `avatar-studio`, `protocol`

## Context

Eve already has a global modal and a server-side tool loop, but direct scene mutation from the server would bypass the browser editor's selection, undo history, capability checks, and confirmation UI. Avatar Studio needs Eve to inspect the current selection and request useful actions without claiming that an action succeeded before the editor applies it.

## Decision

- Send bounded Avatar Studio context with Eve requests through the optional `editor_context` field.
- Expose one strict `avatar_editor_action` tool whose command and arguments are validated on the server.
- Return action events to the browser; the frontend resolves node targets, applies existing editor handlers, and confirms save, export, and destructive changes.
- Keep all scene mutation in `ModelingStudioWorkspace`; the backend handler only emits a validated action contract.

## Consequences

- **Positive:** Eve actions use the same transform, keyframe, save, and export paths as direct UI interactions, preserving local history and capability rules.
- **Negative / Cost:** Actions are asynchronous and can be rejected when a node disappears or the user declines confirmation; Eve must communicate that boundary.
- **Follow-up:** add richer material and animation commands only after matching editor handlers and tests exist.

## Alternatives Considered

| Alternative | Why rejected |
|-------------|--------------|
| Server mutates persisted scene JSON | Bypasses the open editor and can overwrite unsaved local changes. |
| Free-form commands in assistant text | Not machine-validatable or safely targetable. |
| Separate Avatar Studio assistant | Duplicates Eve identity and global session behavior. |

## References

- `server/app/services/eve/tools/avatar.py`
- `server/app/services/eve/handlers/avatar.py`
- `website/src/pages/avatar-studio/ModelingStudioWorkspace.jsx`
- `website/src/components/EveAssistantModal.jsx`
