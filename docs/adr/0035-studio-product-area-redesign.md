# ADR 0035 — Unified Studio product-area redesign

## Status

Accepted

- Date: 2026-09-06
- Deciders: StarWaves product team
- Tags: `studio`, `frontend`, `api-contract`, `metadata`

## Context

Studio had the right core workflows but its Builder, Apps, and Templates routes
looked like separate utility screens. The Builder had no real-data continuation
context, while Apps and Templates exposed only a small portion of the metadata
already available to the product. The redesign needs stronger visual hierarchy
without introducing demo content or a separate activity system.

## Decision

- Unify the three routes around the Studio module accent, spacious editorial
  surfaces, prompt-first Builder composition, and shared tab navigation.
- Extend Studio project responses with `preview_status` and a compact
  `last_activity` summary. Persist only the latest summary in existing
  workspace metadata.
- Extend template summaries with category, capability tags, featured state,
  and ordering metadata. Curated metadata remains code-owned; custom template
  metadata is derived from the source project.
- Keep preview URLs available only from the explicit preview action; list and
  gallery responses expose readiness, not signed URLs.

## Consequences

- **Positive:** Builder continuation cards, Apps status surfaces, and Template
  filters use real data and share one visual language.
- **Negative / Cost:** Existing Studio response schemas and metadata writes need
  backward-compatible defaults for older workspace records.
- **Follow-up:** A full historical activity timeline can be added later without
  changing this compact latest-activity contract.

## Alternatives Considered

| Alternative | Why rejected |
|-------------|--------------|
| Add a separate activity/event table | More persistence and query complexity than the current gallery needs. |
| Keep the existing response shapes | Prevents Apps/Templates from showing meaningful status and catalog context. |
| Redesign only the Builder | Leaves the Studio product area visually fragmented. |

## References

- `website/src/pages/studio/StudioProjectsPage.jsx`
- `server/app/schemas/studio.py`
- `server/app/repositories/studio.py`
