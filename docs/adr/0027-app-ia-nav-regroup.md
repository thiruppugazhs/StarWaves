# ADR 0027 — App IA Regroup (Phase 0)

## Status

Accepted — merges approved and implemented (2026-09-06)

- Date: 2026-09-06
- Deciders: user (pending merge approval)
- Tags: `frontend`, `ia`, `navigation`

## Context

The sidebar showed 29 items in 6 legacy groups (Work, Studio, Eve AI, Growth, Communication, Account) that no longer match the product story (Code · Create · Evolve). Findings from the route inventory (`App.jsx` `pages` map + `config/navigation.js`): Eve AI occupies 6 nav entries for what is mostly one page (`EvePage` with `activeSubpage` chat/sessions/memory/call/schedules + `AvatarPage`); `competitive-coding` and `stats` overlap on contest ratings; `chats` vs Eve chat vs WhatsApp is three messaging surfaces with unclear boundaries; `studio-apps`/`studio-templates` are sub-views promoted to top level; detail routes (project/hackathon/document/studio-detail) are correctly hidden already.

## Decision

Applied now (display-only, zero routing change — ids are frozen contracts, sidebar sections derive from array order):

- Groups regrouped to Home (dashboard) · Code (workspace, projects, documents, todo) · Create (studio, apps, templates, jobs, hackathons) · Evolve (eve ×5 subpages, avatar, competitive-coding, stats) · Connect (calendar, mails, whatsapp, chats, calls, contacts) · You (profile, themes, setting, usage).
- `GROUP_MODULE_MAP` repointed (Home/Code→work, Create→studio, Evolve→eve, Connect→comm, You→account); per-item `module` accents untouched, so no CSS changes.
- Label `Chat`→`Eve` (it collided with `Chats`); search badges and page eyebrows realigned to the new group names.
- Scope: `config/navigation.js`, `config/search/pages.js` + `evePages.js` badges, 6 eyebrow lines. No route, id, or behavior change.

## Consequences

- **Positive:** sidebar tells the Code/Create/Evolve story today; Eve/Connect disambiguation starts; search palette consistent.
- **Negative / Cost:** Evolve is heavy (9 entries) until Eve collapses to tabs; group rename touches badges/eyebrows that rebuild waves will revisit anyway.
- **Follow-up:** needs sign-off — see pending merges.

## Merges — approved and implemented (2026-09-06)

Old ids stay resolvable (deep links, dashboard widgets, palette entries keep working); sidebar shows the merged entries only.

| Merge | Implementation |
|-------|----------------|
| Eve subpages → tabs | `EvePage` gained a `TabNav` (Chat/Sessions/Memory/Voice/Schedules) synced both ways with the `eve*` ids; sidebar keeps one `Eve` entry; `AppLayout` highlights `eve` for all sub-ids |
| Compete page | New `CompetePage` (Contests/Stats tabs over existing pages); `compete` in nav + router; `competitive-coding`/`stats` ids render it with the matching tab |
| Chats3 | `Chats` retitled `Team Chats` (nav + palette) to disambiguate from Eve chat; WhatsApp/Eve scopes untouched |
| Studio children | New `StudioTabs` (Builder/Apps/Templates) on all three Studio pages; sidebar keeps one `Studio` entry |

## Alternatives Considered

| Alternative | Why rejected |
|-------------|--------------|
| Regroup + merge in one commit | Merges change deep links and need explicit approval; regroup is safely reversible |
| Keep legacy groups through rebuild | Waves would cement the old story into new UI; IA must lead, not follow |

## References

- `website/src/config/navigation.js:1`
- `website/src/App.jsx:376` (`pages` map)
- `website/src/components/Sidebar.jsx:17` (dynamic grouping)
