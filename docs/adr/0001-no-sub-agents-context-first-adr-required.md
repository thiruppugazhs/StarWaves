# ADR 0001 — No sub-agents, context.md first, ADRs required

## Status

Accepted

- Date: 2026-08-30
- Deciders: Starwaves maintainers
- Tags: `process`, `agent-workflow`, `docs`

## Context

Agents previously delegated work to sub-agents (`Task` tool / `explore` / `general`), re-read the entire tree with `Glob **/*`, and ignored `context.md` as the living snapshot. This caused duplicate reads, hidden file-level decisions, broken tiered loading, stale `context.md`, and architectural changes without a record. `AGENTS.md` already defined the 4-layer backend and frontend rules, but had no hard gate against delegation and no ADR requirement.

We need a single, auditable session — one commit history, one snapshot (`context.md` < 15k), and a durable record for non-trivial architecture choices. The fix must be enforceable via `AGENTS.md` + `opencode.json` instructions and visible in `PROJECT_MAP.md`.

## Decision

1. **No sub-agents — direct execution only** (`AGENTS.md` §1.6): All reasoning, searching, reading, editing, verification, and commits run directly in the primary agent session. `Task` delegation, sub-agent spawns, or background wrappers are prohibited. Allowed only when the user explicitly writes "use sub-agents" and the reason is noted in the commit/ADR. Instead, use `Grep` (with `include`), `Read` on 1–2 files located via `PROJECT_MAP.md`, and `Bash`/`Edit`/`Write` directly; break large work into a local `TodoWrite` list.

2. **context.md first, tiered loading enforced** (`AGENTS.md` §1.5 + §1.1): Tier 0 preloads `AGENTS.md` + `PROJECT_MAP.md` via `opencode.json` `instructions`. Tier 1 uses `PROJECT_MAP.md` to locate files. Tier 2 reads `context.md` only for cross-cutting/infra tasks. Tier 3 uses targeted `Grep`/`Read`. Prohibited: `Glob **/*` without `include`, full tree scans, re-reading all files. `context.md` stays < 15k / ~4k tokens; every implementation change updates it in the same commit (single `Last updated` one-liner; old detail moves to `CHANGELOG.md`).

3. **ADRs required for non-trivial architecture** (`AGENTS.md` §1.7): Every architectural decision (patterns, layering, DB schema, auth/cache, frontend state/styling/routing, infra/deploy, dependencies, rejected alternatives) must have an ADR under `docs/adr/NNNN-kebab-case-title.md` from `_template.md`. Index in `docs/adr/README.md`. Lifecycle `Proposed → Accepted → Superseded/Deprecated` with cross-links. ADR ships in the same commit as the code it justifies. Trivial bug fixes / copy changes are exempt.

Files introduced: `docs/adr/_template.md`, `docs/adr/README.md`, this ADR `0001-*.md`; updated `AGENTS.md` §1.6/§1.7, `PROJECT_MAP.md` ADR section, `context.md` snapshot, `opencode.json` instructions remain `["AGENTS.md","PROJECT_MAP.md"]`.

## Consequences

- **Positive:** One auditable session; fewer wasted reads; `context.md` stays current and compact; architecture is searchable and reversible via ADRs; onboarding via `PROJECT_MAP.md` fast-path.
- **Negative / Cost:** Agents must write an ADR for architectural work (adds ~10 minutes); reviewers must enforce the gate; trivial changes must still judge "is this architectural?".
- **Follow-up:** Update `context.md` on every future ADR; lint ADRs in CI if numbering drifts; add ADR check to PR template.

## Alternatives Considered

| Alternative | Why rejected |
|-------------|--------------|
| Keep sub-agents with a wrapper protocol | Still duplicates reads, hides decisions, violates tiered loading; harder to enforce than a ban. |
| Store context in many files (no `context.md` snapshot) | Loses single living snapshot; `CHANGELOG.md` already holds history, `context.md` is the compact current state. |
| No ADRs, rely on commit messages | Commits are not discoverable for architecture; ADRs provide structured alternatives and consequences. |
| ADRs in `docs/decisions/` or wiki | `docs/adr/` is the industry convention; `_template.md` + `README.md` index keeps discovery trivial. |

## References

- `AGENTS.md` §1.5 Tiered Context Loading, §1.6 No Sub-Agents, §1.7 ADRs
- `PROJECT_MAP.md` Top-Level Structure + Docs section
- `context.md` Last updated one-liner + §6 Current snapshot
- `opencode.json` `instructions: ["AGENTS.md","PROJECT_MAP.md"]`
- `docs/adr/_template.md`, `docs/adr/README.md`
