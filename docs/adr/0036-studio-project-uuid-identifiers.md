# ADR 0036 — UUID identifiers for Studio project routes

## Status

Accepted

- Date: 2026-09-06
- Deciders: StarWaves maintainers
- Tags: `studio`, `routing`, `identifiers`

## Context

Studio project workspace IDs are currently derived from the project name. That makes detail URLs readable, but it couples a storage/routing identifier to user-provided text and can expose project naming details in browser history and shared links. It also requires collision handling and makes future renames harder to reason about.

The Studio detail route already passes the project ID through the frontend router and API clients, so the identifier can be changed at project creation without introducing a second routing contract.

## Decision

- Generate a canonical UUID string for every newly created Studio project in `server/app/repositories/studio.py`.
- Continue storing the human-readable project name separately as `name` and use it for headings, cards, and builder copy.
- Keep existing name-based workspace IDs readable for backward compatibility; do not rename existing directories implicitly.
- Preserve the existing `/app/studio/{projectId}` route and API paths, with the UUID occupying `{projectId}` for new projects.
- Keep the Studio detail shell full-height through the existing `.content:has(.studio-builder)` layout rule and an explicit route-child height rule.

## Consequences

- **Positive:** New Studio URLs are stable, collision-resistant, and independent of project names.
- **Positive:** Renaming a project does not change its route or workspace directory.
- **Negative / Cost:** New URLs are less human-readable, and old projects retain legacy IDs until migrated explicitly.
- **Follow-up:** A separate migration can convert legacy projects if a uniform identifier policy becomes necessary.

## Alternatives Considered

| Alternative | Why rejected |
|-------------|--------------|
| Keep name-based IDs | Couples identity to mutable user text and requires collision suffixes. |
| Add a separate public slug field | Adds another identifier mapping and migration surface for the current route/API contract. |
| Rename all existing workspaces now | Destructive and unnecessary for the requested behavior. |

## References

- `server/app/repositories/studio.py`
- `website/src/hooks/useRouter.js`
- `website/src/styles/layout-symmetry.css`
