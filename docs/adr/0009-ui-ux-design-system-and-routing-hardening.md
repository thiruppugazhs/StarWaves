# ADR 0009 — UI/UX Design System and Routing Hardening

**Status:** Accepted  
**Date:** 2026-09-01

---

## Context

A comprehensive audit of the entire frontend (`/website/src`) identified six categories of issues affecting correctness, consistency, and maintainability:

1. **Modal duplication in WorkspacePage** — Create, Rename, and Delete Workspace modals were duplicated in both the `overview` branch and the `ide` return path, doubling JSX and creating drift risk.
2. **Active-workspace delete regression** — `handleConfirmDeleteWorkspace` did not redirect to the overview view after deleting the currently active or last workspace.
3. **`navigateWorkspace` hackathon routing** — The wrapper only accepted `(page, projectId, documentId)`. Callers routing to `hackathon-detail` were relying on positional ambiguity; the `hackathonId` was never forwarded to `useRouter.navigate`.
4. **`LoadingState` prop mismatch** — Several pages (`UsagePage`, `CustomPage`) passed `label="..."` while the component only destructured `message`. Labels were silently dropped.
5. **`CustomDropdown` usability gap** — Long option lists (AI model catalogs, language selectors) had no search/filter, requiring users to scroll through 30+ items.
6. **Inline styles** — `CallsPage`, `WhatsAppPage`, and `MailsPage` contained `style={{ ... }}` attributes for layout values that belong in CSS classes, violating the no-inline-styles rule (`AGENTS.md §4.3.4`).  
   Additionally, an unnecessary regex escape `\-` in `MailsPage`'s `ALLOW_URI_REGEXP` was producing linter warnings.

---

## Decision

All six issues are fixed at the root cause without hacks or workarounds:

1. **WorkspacePage unification** — Merged the two render branches (`if (view === 'overview')` early return + main return) into a single `return` that uses a `view === 'overview' ? <> … </> : <> … </>` ternary. The Create/Rename/Delete workspace modals are now rendered once, outside both branches, at the bottom of the component.
2. **Delete redirect** — `handleConfirmDeleteWorkspace` captures `targetId` before the async delete, then calls `setView('overview')` when `workspace.activeWorkspaceId === targetId || workspace.workspaces.length <= 1`.
3. **`navigateWorkspace` signature** — Extended to `(page, projectId = null, documentId = null, hackathonId = null)`. When routing to `hackathon-detail`, `hackathonId` falls back to `projectId` (for callers that pass `hackathon.id` in position 2), and `projectId` is cleared to `null` to avoid polluting router state.
4. **`LoadingState` normalization** — Destructures both `label` and `message`; computes `const text = label || message || 'Loading…'`. Zero-regression: all existing `message` callers continue to work.
5. **`CustomDropdown` searchable prop** — New `searchable = false` / `searchPlaceholder = 'Search…'` props. When enabled, a sticky search input appears at the top of the listbox; `filteredOptions` is `useMemo`-derived from `options` × `searchQuery`. An empty-state message is shown when no options match. Keyboard arrows operate on `filteredOptions`.
6. **Inline styles → CSS classes** — `calls-provider-toggle` gets `margin-bottom: 12px` in `calls.css`. WhatsApp progress bar fill uses `width: var(--progress, 0%)` driven by `style={{ '--progress': ... }}` (valid dynamic-value exception). `whatsapp-sync-footer-status`, `whatsapp-sync-footer-percent`, `whatsapp-sync-retry-btn` added to `whatsapp.css`. `mail-retry-btn` added to `mails.css`. `ALLOW_URI_REGEXP` escape corrected from `[a-z+.\-]+` to `[a-z+.-]+`.

---

## Consequences

- **Positive:** WorkspacePage JSX shrinks by ~120 lines; single source of truth for workspace modals. `LoadingState` now correctly renders for all callers. Dropdown search improves UX for long lists. No inline styles remain in the audited pages.
- **Positive:** `navigateWorkspace` is now a stable, forward-compatible API for adding future navigation dimensions without positional ambiguity.
- **Neutral:** `CustomDropdown` gains two optional props; all existing usages are unaffected.
- **Risk:** None — all changes are backward-compatible and covered by build + lint verification.

---

## Alternatives Considered

- **Keep the `if (view === 'overview')` early-return pattern** — Rejected because duplicating modals is a DRY violation that grows over time.
- **Add a dedicated `<WorkspaceModals>` sub-component** — Valid, but over-engineering for 3 modals. The single unified return is sufficient.
- **Use a third-party `react-select` for searchable dropdowns** — Rejected per `AGENTS.md §4.1` (no new frameworks without explicit approval). The native implementation is lightweight and consistent with the design system.

---

## Files Changed

- [`WorkspacePage.jsx`](file:///c:/project/starwaves/website/src/pages/WorkspacePage.jsx)
- [`App.jsx`](file:///c:/project/starwaves/website/src/App.jsx)
- [`LoadingState.jsx`](file:///c:/project/starwaves/website/src/components/ui/LoadingState.jsx)
- [`CustomDropdown.jsx`](file:///c:/project/starwaves/website/src/components/ui/CustomDropdown.jsx)
- [`custom-dropdown.css`](file:///c:/project/starwaves/website/src/styles/components/custom-dropdown.css)
- [`MailsPage.jsx`](file:///c:/project/starwaves/website/src/pages/MailsPage.jsx)
- [`mails.css`](file:///c:/project/starwaves/website/src/styles/pages/mails.css)
- [`CallsPage.jsx`](file:///c:/project/starwaves/website/src/pages/CallsPage.jsx)
- [`calls.css`](file:///c:/project/starwaves/website/src/styles/pages/calls.css)
- [`WhatsAppPage.jsx`](file:///c:/project/starwaves/website/src/pages/WhatsAppPage.jsx)
- [`whatsapp.css`](file:///c:/project/starwaves/website/src/styles/pages/whatsapp.css)
- [`CompetitiveCodingPage.jsx`](file:///c:/project/starwaves/website/src/pages/CompetitiveCodingPage.jsx) (Search icon import fix)
- [`JobsPage.jsx`](file:///c:/project/starwaves/website/src/pages/JobsPage.jsx) (Edit modal Role/Status fields)
