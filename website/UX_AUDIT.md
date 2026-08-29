# StarWaves Comprehensive UX Audit

**Audit date:** 26 July 2026  
**Product surface:** React web application in `website/`  
**Evidence standard:** Public routes were observed live. Authenticated routes were reviewed through code, state, API, and responsive-style inspection because no audit account or demo bypass exists.  
**Status:** Baseline audit with remediation status updated after the first implementation pass.

## 1. Executive summary

StarWaves is a personal productivity workspace for developers and students. It combines tasks, calendars, coding contests, hackathons, projects, job applications, documents, email, chat, statistics, and external integrations. The core product proposition is consolidation: users should be able to understand and advance their work without moving between many services.

The application has a broad feature set but currently carries more interaction risk than its visual polish suggests. The largest problems are structural:

1. Dialog behavior is not consistently accessible. The shared modal lacks dialog semantics, focus containment, initial focus, and focus restoration.
2. Primary navigation depends on hover proximity to reveal labels, excluding keyboard and touch-like desktop input patterns and making the information architecture difficult to scan.
3. Controls and text are frequently too small. Live measurements found 9 of 21 landing-page controls below 24px in at least one dimension and 17 below the 44px mobile guidance. Authentication and legal routes show the same pattern.
4. Several core actions lack adequate state communication or recovery. Examples include backdrop-dismissed mail composition, integration disconnects, inconsistent async announcements, and generic destructive confirmations.
5. The calendar exposes a prominent **New event** button with no action handler. This is a direct broken-affordance problem.
6. Authenticated navigation presents 12 largely equal destinations. Settings alone contains many unrelated integration, profile, coding, source, and account-management workflows in one long page.
7. Accessibility is handled locally rather than systematically. Some components have good labels and keyboard handlers; others recreate dialogs and clickable rows without equivalent behavior.

No public route produced a blank screen, Vite overlay, console error, or horizontal page overflow at 1440, 1024, 768, 520, or 320px in either theme. That is a useful technical baseline, but it does not offset the task-level and accessibility defects above.

### Highest business risks

- **Activation:** A first-time user sees a large promise before seeing how integrations, privacy, and the workspace fit together.
- **Retention:** The flat navigation and settings density increase the cost of returning to a task.
- **Trust:** Integration and security claims are stronger than the product's visible explanations and recovery mechanisms.
- **Accessibility exposure:** Dialogs, target sizing, keyboard discoverability, drag interactions, and status announcements are not consistently WCAG 2.2-ready.
- **Feature credibility:** Dead or incomplete controls undermine confidence in the rest of the workspace.

## 2. Product and journey model

### Purpose and audiences

| Dimension | Audit conclusion |
|---|---|
| Product purpose | Consolidate a developer's personal work, growth, applications, communication, and external-service data. |
| Primary users | Students, early-career developers, competitive programmers, hackathon participants, job seekers, and multi-project builders. |
| Secondary users | Returning power users managing multiple accounts, calendars, and data sources. |
| Primary business goal | Convert users from landing page to account creation, then create recurring usage through a unified workspace. |
| User goals | Capture work, find the next action, monitor progress, avoid missed dates, and reduce context switching. |
| Critical actions | Sign up, create/complete a task, inspect calendar commitments, maintain projects/jobs, connect integrations, and recover from failures. |

### Primary journey

1. Understand the consolidation promise on Landing.
2. Create or access an account.
3. Complete onboarding.
4. Orient in Dashboard and navigation.
5. Add work or connect existing sources.
6. Monitor tasks, dates, projects, applications, and activity.
7. Recover from errors, disconnect services, or delete the account.

### Route and screen inventory

| Route/screen | Primary workflow | Evidence |
|---|---|---|
| `/` Landing | Understand value, evaluate trust, start signup/login | Live observed |
| `/login` | Authenticate, reset password, use Google | Live observed; submission not exercised |
| `/signup` | Create account | Live observed; submission not exercised |
| `/onboarding` | Set display name and enter workspace | Code verified |
| `/privacy` | Understand data collection and controls | Live observed |
| `/terms` | Understand account and integration terms | Live observed |
| `/app/dashboard` | Orient, view widgets, create work, customize layout | Code verified |
| `/app/stats` | Review coding, project, GitHub, and hackathon metrics | Code verified |
| `/app/todo` | Filter, create, edit, complete, and delete tasks | Code verified |
| `/app/calendar` | Browse dates and inspect aggregated activity | Code verified |
| `/app/mails` | Connect, search, read, paginate, compose, archive, and delete mail | Code verified |
| `/app/chats` | Connect and use Google Chat conversations | Code verified |
| `/app/competitive-coding` | Filter and inspect contests/platforms | Code verified |
| `/app/hackathons` | Search, filter, create, inspect, and delete hackathons | Code verified |
| `/app/projects` | Search, filter, create, inspect, edit, and delete projects | Code verified |
| Project detail | Inspect progress, links, team data, edit/delete | Code verified |
| `/app/jobs` | Search, filter, create, update, and delete applications | Code verified |
| `/app/documents` | Create, upload/import, search, open, and delete documents | Code verified |
| Document opener | Read/edit a selected document | Code verified |
| `/app/profile` | View and edit profile | Code verified |
| `/app/setting` | Manage profile, integrations, sources, coding profiles, and account | Code verified |

## 3. Audit method and limitations

- Live checks covered five public routes, five widths, light/dark themes, DOM content, heading order, control dimensions, accessible-name heuristics, error overlays, console errors, and horizontal overflow.
- Static inspection covered every page component, shared shell, navigation, modal primitives, UI components, API state handling, responsive styles, dark-theme tokens, and reduced-motion rules.
- Automated measurements are indicators, not WCAG conformance certification. Nested form labels, spacing exceptions, assistive-technology behavior, and contrast over composited backgrounds require manual verification.
- Authenticated runtime behavior, backend latency, OAuth consent, real email/chat data, drag behavior with assistive input, and actual screen-reader announcements remain follow-up tests.
- This is an expert review, not user research. Severity reflects likely impact and reach; validate it with representative users.

## 4. Issue registry

### UX-01 — Dialog infrastructure is not accessible

- **Location:** Shared `Modal`, ConfirmDialog, profile editor, task/project/job/document dialogs, mail reader/composer, calendar detail panel, settings delete-account dialog
- **Description:** The shared modal renders a visual container but no `role="dialog"`, `aria-modal`, or title relationship. It closes on Escape but does not set initial focus, trap focus, make the background inert, or restore focus to the opener. Several pages implement separate modal patterns.
- **Why it hurts UX:** Keyboard and screen-reader users can move behind the overlay, lose context, or not know that a dialog opened. Inconsistent implementations create inconsistent dismissal and focus behavior.
- **Who is affected:** Keyboard, screen-reader, switch-control, low-vision, and power users
- **Severity:** **Critical**
- **Evidence:** `Code verified` — shared `Modal.jsx` and page-specific overlays
- **Expected behavior:** Opening a dialog announces its name, moves focus inside, contains focus, supports Escape where safe, prevents background interaction, and returns focus to its trigger.
- **Recommended solution:** Build one accessible modal primitive using a native `<dialog>` or a proven focus-management implementation. Require title/description IDs, initial-focus policy, focus restoration, scroll locking, and a deliberate backdrop-dismiss option.
- **Difficulty:** Medium
- **Estimated UX impact:** Very high; removes a cross-product access barrier
- **Before → after:** Visual overlay with ad hoc behavior → predictable, announced, keyboard-contained task context

### UX-02 — Sidebar label discovery depends on pointer proximity

- **Location:** Authenticated app shell and Sidebar
- **Description:** Desktop expansion is controlled by global pointer position. Keyboard focus, screen magnification, stylus use, and users who do not discover the hover zone do not get an equivalent persistent expansion control.
- **Why it hurts UX:** Icons alone force recall and interpretation across 12 destinations. The navigation can collapse while attention moves into content.
- **Who is affected:** First-time users, keyboard users, users with cognitive or visual impairments, and occasional users
- **Severity:** **High**
- **Evidence:** `Code verified` — pointer-move boundary logic in `AppLayout.jsx`
- **Expected behavior:** Navigation labels are available without a precision-hover interaction, with an explicit collapse/expand control and persisted preference.
- **Recommended solution:** Add a labeled toggle, expand on `:focus-within`, preserve the user's choice, and provide tooltips only as secondary support. Keep mobile as a conventional drawer.
- **Difficulty:** Medium
- **Estimated UX impact:** High; improves findability and orientation

### UX-03 — Interactive targets and supporting text are systematically undersized

- **Location:** Landing navigation/FAQ, authentication, legal pages, icon buttons, toolbars, filters, tags, card metadata, calendar controls
- **Description:** Many components use 8–11px text and controls below 24px or 44px in one dimension.
- **Why it hurts UX:** Small targets increase errors and fatigue. Small text is difficult at normal zoom and becomes worse on dense mobile screens.
- **Who is affected:** Mobile users, low-vision users, users with motor impairments, and users in poor viewing conditions
- **Severity:** **High**
- **Evidence:** `Live observed` — landing: 9/21 controls below 24px and 17/21 below 44px at tested widths; legal/auth routes also contain undersized controls. `Code verified` — repeated 8–11px declarations.
- **Expected behavior:** Essential targets meet WCAG 2.2's 24×24 CSS px minimum or spacing exception; primary mobile controls target approximately 44×44. Body/supporting text remains comfortably readable.
- **Recommended solution:** Establish compact/default/large control variants with minimum hit areas, raise the minimum supporting-text size, and test 200% zoom and text-spacing overrides.
- **Difficulty:** Medium
- **Estimated UX impact:** Very high; product-wide readability and input accuracy

### UX-04 — There is no bypass link or route-level focus management

- **Location:** Public header, authenticated Header/Sidebar, custom router
- **Description:** Repeated navigation precedes content without a skip link. Client-side route changes scroll to the top but do not move focus to the page heading or main content.
- **Why it hurts UX:** Keyboard and screen-reader users repeatedly traverse global controls and may not receive confirmation that navigation occurred.
- **Who is affected:** Keyboard, screen-reader, switch-control, and power users
- **Severity:** **High**
- **Evidence:** `Code verified` — `App.jsx`, `AppLayout.jsx`, public pages
- **Expected behavior:** A visible-on-focus “Skip to main content” link exists, and route changes update title and focus the new page heading/main region.
- **Recommended solution:** Add a stable main-content ID, route-title map, skip link, and focus-on-navigation hook that respects back/forward navigation.
- **Difficulty:** Medium
- **Estimated UX impact:** High for non-pointer navigation

### UX-05 — “New event” is a dead primary action

- **Location:** Calendar toolbar
- **Description:** The prominent New event button has no `onClick` behavior.
- **Why it hurts UX:** It advertises a core workflow and then does nothing, which damages trust and makes users question whether the calendar is read-only or broken.
- **Who is affected:** All calendar users, especially first-time users
- **Severity:** **High**
- **Evidence:** `Code verified` — `CalendarPage.jsx`
- **Expected behavior:** The button opens an event form, delegates clearly to a connected calendar, or is absent/disabled with an explanation.
- **Recommended solution:** Implement event creation with account/calendar selection and error recovery. If creation is not supported, remove the control and label the view as read-only.
- **Difficulty:** Hard for full integration; Easy to remove/clarify
- **Estimated UX impact:** High

### UX-06 — Destructive actions lack consistent risk communication

- **Location:** Projects, jobs, tasks, documents, notifications, mail, integrations, and account deletion
- **Description:** Generic confirmation copy and a generic primary Confirm button are reused for destructive actions. Some disconnect/delete paths occur directly; mail trash/archive actions have no undo.
- **Why it hurts UX:** Users cannot reliably distinguish reversible from permanent actions or identify exactly what will be removed.
- **Who is affected:** All users; higher risk for users managing multiple accounts
- **Severity:** **High**
- **Evidence:** `Code verified` — ConfirmDialog and page action handlers
- **Expected behavior:** Confirmation names the object and consequence, destructive actions have a distinct role, and reversible actions offer undo.
- **Recommended solution:** Create destructive-confirm and reversible-action patterns. Include object name, downstream impact, cancel-first focus, pending state, failure state, and undo where technically possible.
- **Difficulty:** Medium
- **Estimated UX impact:** High; prevents costly mistakes

### UX-07 — Mail composition can be lost through accidental dismissal

- **Location:** Mail compose modal
- **Description:** Clicking the backdrop or close/discard controls removes the compose state without checking for unsaved recipients, subject, or body.
- **Why it hurts UX:** Accidental clicks can destroy meaningful work with no recovery.
- **Who is affected:** Mail users, touchpad users, users with motor impairments
- **Severity:** **High**
- **Evidence:** `Code verified` — compose modal state is cleared on backdrop
- **Expected behavior:** Empty drafts close immediately; non-empty drafts prompt to discard or save, or autosave reliably.
- **Recommended solution:** Track a dirty state, disable backdrop dismissal when dirty, provide Save draft/Discard/Continue editing, and restore focus on close.
- **Difficulty:** Medium
- **Estimated UX impact:** High

### UX-08 — Dashboard customization is pointer-centric and cognitively expensive

- **Location:** Dashboard edit/customize mode
- **Description:** Widget arrangement uses drag/resize behavior without a documented keyboard alternative. Edit mode adds controls to an already dense dashboard.
- **Why it hurts UX:** Users who cannot drag cannot fully customize. First-time users face configuration before understanding which widgets matter.
- **Who is affected:** Keyboard and motor-impaired users; first-time users
- **Severity:** **High**
- **Evidence:** `Code verified`; drag behavior requires authenticated runtime validation
- **Expected behavior:** Reordering and resizing work with keyboard controls and announce position/size changes. Defaults serve common workflows without setup.
- **Recommended solution:** Add Move up/down/left/right and size controls, live announcements, Reset layout, and curated presets. Keep advanced editing behind a clear mode.
- **Difficulty:** Hard
- **Estimated UX impact:** High for accessibility; medium for general usability

### UX-09 — Mail/message rows and custom interactive containers are inconsistent

- **Location:** Mail list, notifications, calendar detail records, dashboard widgets, custom dropdowns
- **Description:** The codebase mixes native buttons/links with clickable `div` elements using partial keyboard emulation. Space-key handling and nested controls are inconsistent.
- **Why it hurts UX:** Role, name, focus, and activation behavior differ for visually similar controls. Nested buttons inside button-like rows can create ambiguous interaction.
- **Who is affected:** Keyboard, screen-reader, voice-control, and switch users
- **Severity:** **High**
- **Evidence:** `Code verified`
- **Expected behavior:** Native controls are used wherever possible; composite widgets follow one documented keyboard model.
- **Recommended solution:** Convert navigation/action rows to `<button>` or `<a>`. For true composite widgets, implement roving tabindex, documented roles, and consistent Enter/Space behavior.
- **Difficulty:** Medium
- **Estimated UX impact:** High

### UX-10 — Integration management is overloaded and risky

- **Location:** Settings → Apps
- **Description:** Google Workspace, Calendar, ICS, Gmail, Chat, GitHub, coding profiles, contest sources, hackathon sources, profile, and account deletion are presented in one long page. A connected service's top-level action often becomes Disconnect, placing a destructive action in the primary position.
- **Why it hurts UX:** Users must scan a long heterogeneous page and can disconnect all accounts while intending to manage or add one.
- **Who is affected:** Returning users and users with multiple accounts/integrations
- **Severity:** **High**
- **Evidence:** `Code verified`
- **Expected behavior:** Settings has stable categories, clear per-account state, separate Manage/Add/Disconnect actions, and explicit permission summaries.
- **Recommended solution:** Add settings subnavigation with Profile, Integrations, Sources, Appearance, and Account. Use a Manage view per integration and move disconnect actions into secondary overflow/confirmation flows.
- **Difficulty:** Hard
- **Estimated UX impact:** Very high

### UX-11 — Security and data-handling claims need product-level substantiation

- **Location:** Landing FAQ/data section, Privacy, Terms, authentication
- **Description:** Copy makes specific claims about Firebase, GCP, isolated datasets, TLS/SSL, and AES-256. The frontend currently uses a custom token API and browser storage; the audit cannot verify backend architecture, retention, encryption implementation, or OAuth scopes.
- **Why it hurts UX:** Unverifiable or outdated claims create legal and trust risk, especially for a product requesting access to mail, calendars, files, and chat.
- **Who is affected:** Prospective users, security-conscious users, administrators, and the business
- **Severity:** **High**
- **Evidence:** `Live observed` copy; `Inferred—requires backend/legal validation`
- **Expected behavior:** Claims accurately match the current architecture, scopes, retention, revocation, and deletion behavior.
- **Recommended solution:** Run legal/security review; publish a concise data map and integration-specific permissions; state retention/deletion timelines; avoid infrastructure claims that cannot be continuously verified.
- **Difficulty:** Medium organizational effort
- **Estimated UX impact:** High trust and compliance impact

### UX-12 — Navigation is flat, crowded, and inconsistently named

- **Location:** Sidebar and global search
- **Description:** Twelve destinations have nearly equal weight. “Stats,” “Competitive Coding,” “Hackathons,” and “Projects” overlap conceptually; “Mails” and singular “Setting” do not follow common terminology.
- **Why it hurts UX:** Users must learn the product's internal taxonomy rather than scan meaningful groups.
- **Who is affected:** First-time and infrequent users
- **Severity:** **Medium**
- **Evidence:** `Code verified`
- **Expected behavior:** Destinations are grouped by user intent and use conventional labels.
- **Recommended solution:** Group into Overview, Plan, Build & Grow, Communication, and System; rename “Mails” to “Mail” and “Setting” to “Settings”; validate with tree testing.
- **Difficulty:** Medium
- **Estimated UX impact:** High findability improvement

### UX-13 — Global search promises more than it provides

- **Location:** Header search
- **Description:** “Search pages” only matches navigation destinations, while the surrounding workspace contains projects, tasks, jobs, documents, mail, and chats.
- **Why it hurts UX:** A prominent global search creates an expectation of content retrieval. Returning no task/project match appears like missing data.
- **Who is affected:** Returning and power users
- **Severity:** **Medium**
- **Evidence:** `Code verified`
- **Expected behavior:** The label makes scope explicit, or search covers workspace records with grouped results.
- **Recommended solution:** Short term, label it “Go to page.” Long term, implement command-palette groups for Pages, Tasks, Projects, Jobs, and Documents with keyboard navigation and recent items.
- **Difficulty:** Easy for relabel; Hard for federated search
- **Estimated UX impact:** Medium to high

### UX-14 — Async feedback is inconsistent and often not announced

- **Location:** Authentication reset messages, creation/edit forms, integrations, load-more controls, mail/chat requests, notifications
- **Description:** Some messages use `role="status"` or `role="alert"`; others are plain text. Loading frequently changes button copy without `aria-busy`, and success feedback lacks a consistent location or duration.
- **Why it hurts UX:** Users may repeat actions, miss completion, or not know whether data was saved.
- **Who is affected:** All users, especially screen-reader and slow-network users
- **Severity:** **Medium**
- **Evidence:** `Code verified`
- **Expected behavior:** Every async flow exposes pending, success, empty, and failure states consistently and accessibly.
- **Recommended solution:** Create shared AsyncButton, inline status, and toast/banner patterns. Use `aria-busy`, polite status announcements, specific recovery actions, and preserve entered data on failure.
- **Difficulty:** Medium
- **Estimated UX impact:** High

### UX-15 — Loading states rely on text or blank transitions instead of structure

- **Location:** Initial authentication, workspace data, mail, chat, documents, pagination
- **Description:** Initial auth uses a single “Loading StarWaves…” screen. Data-heavy surfaces generally use button text or isolated spinners rather than stable skeletons.
- **Why it hurts UX:** Layout changes feel slower and users cannot predict what is loading.
- **Who is affected:** Mobile, slow-network, and returning users
- **Severity:** **Medium**
- **Evidence:** `Code verified`; real latency requires authenticated validation
- **Expected behavior:** The shell appears quickly, preserves layout, and identifies which region is loading.
- **Recommended solution:** Add route-level and component-level skeletons that match final geometry, retain stale data during refresh, and distinguish first load from background refresh.
- **Difficulty:** Medium
- **Estimated UX impact:** Medium to high perceived-performance gain

### UX-16 — Error recovery exposes implementation failures without a consistent next step

- **Location:** API-backed pages and integrations
- **Description:** Pages frequently surface `error.message` directly. Retry, reconnect, preserve-input, and support paths vary by feature.
- **Why it hurts UX:** Technical wording does not help users diagnose whether the problem is connectivity, permissions, expired authentication, validation, or server failure.
- **Who is affected:** All users experiencing failures
- **Severity:** **Medium**
- **Evidence:** `Code verified`
- **Expected behavior:** Errors explain what happened, what was preserved, and the safest next action.
- **Recommended solution:** Normalize API errors into user-facing categories and provide Retry, Reauthenticate, Edit input, or Contact support actions. Log diagnostic detail separately.
- **Difficulty:** Medium
- **Estimated UX impact:** High during failure journeys

### UX-17 — Filter and view state is fragile

- **Location:** Projects, jobs, documents, hackathons, contests, tasks, calendar, mail
- **Description:** Most filters and sort choices live only in component state. Navigating away, refreshing, or sharing a view loses context.
- **Why it hurts UX:** Returning and power users repeatedly reconstruct their working view.
- **Who is affected:** Power users and users managing large datasets
- **Severity:** **Medium**
- **Evidence:** `Code verified`
- **Expected behavior:** Meaningful filter/sort/view state survives navigation and can be shared where appropriate.
- **Recommended solution:** Encode stable state in URL query parameters or scoped persisted preferences. Provide active-filter counts and one clear reset action.
- **Difficulty:** Medium
- **Estimated UX impact:** Medium to high efficiency gain

### UX-18 — Calendar becomes a dense horizontal workspace on mobile

- **Location:** Calendar month grid and day details
- **Description:** At mobile widths the month grid remains a seven-column structure with minimum-width cells and horizontal scrolling.
- **Why it hurts UX:** Users must pan both spatially and temporally; event labels become difficult to scan and focus can move off screen.
- **Who is affected:** Mobile and zoom users
- **Severity:** **Medium**
- **Evidence:** `Code verified`; public shell cannot expose authenticated calendar for live validation
- **Expected behavior:** Mobile prioritizes agenda/day/week views with the month grid as navigation, not the primary detailed workspace.
- **Recommended solution:** Default narrow screens to an agenda list grouped by date; retain a compact month picker; keep selected date and actions sticky and accessible.
- **Difficulty:** Hard
- **Estimated UX impact:** High for mobile

### UX-19 — Charts and progress visuals lack equivalent structured data

- **Location:** Stats, Dashboard, Projects, coding progress
- **Description:** Contribution bars, language percentages, progress tracks, and metric visuals are primarily CSS geometry with limited programmatic explanation.
- **Why it hurts UX:** Screen-reader users cannot compare trends, and all users may struggle to interpret unlabeled scales.
- **Who is affected:** Screen-reader, low-vision, and analytical users
- **Severity:** **Medium**
- **Evidence:** `Code verified`
- **Expected behavior:** Every visualization has a title, summary, units, timeframe, and accessible data representation.
- **Recommended solution:** Add semantic summaries and expandable data tables; label min/max/timeframe; keep visual encodings supplemental.
- **Difficulty:** Medium
- **Estimated UX impact:** High for accessible comprehension

### UX-20 — Onboarding does not establish a usable mental model

- **Location:** Onboarding and first Dashboard visit
- **Description:** Onboarding collects a display name and enters a feature-dense workspace. It does not ask about goals, explain navigation, distinguish local from connected data, or guide the first meaningful action.
- **Why it hurts UX:** Users encounter many empty modules without knowing which setup step creates value.
- **Who is affected:** First-time users
- **Severity:** **Medium**
- **Evidence:** `Code verified`
- **Expected behavior:** Onboarding gets users to one meaningful outcome quickly and defers optional integrations.
- **Recommended solution:** Use a short goal-selection step, recommend one setup path, create a first task/project, and show a dismissible checklist. Do not require every integration.
- **Difficulty:** Hard
- **Estimated UX impact:** Very high activation impact

### UX-21 — Empty states explain absence but do not consistently advance work

- **Location:** Dashboard widgets, mail/chat connection states, lists, stats, calendar, documents
- **Description:** Some empty states include a CTA; others only state that nothing exists. Connected-empty, filtered-empty, permission-empty, and error-empty states sometimes look similar.
- **Why it hurts UX:** Users cannot tell whether to create, connect, reset filters, wait, or troubleshoot.
- **Who is affected:** New users and users after changing filters/integrations
- **Severity:** **Medium**
- **Evidence:** `Code verified`
- **Expected behavior:** Empty states identify cause and provide one relevant next action.
- **Recommended solution:** Define four shared variants: first-use, filtered, connected-no-data, and unavailable/error. Include context-specific CTA and preserve the page header.
- **Difficulty:** Medium
- **Estimated UX impact:** High activation and recovery impact

### UX-22 — Public authentication and legal experiences lack system-level consistency

- **Location:** Login, Signup, Privacy, Terms
- **Description:** Legal pages contain extensive inline styles instead of shared components. Password-reset success is plain text rather than an announced status. Public pages do not expose the same appearance controls as the workspace.
- **Why it hurts UX:** Important trust content is harder to maintain, and authentication feedback may be missed.
- **Who is affected:** Prospective users, screen-reader users, maintainers
- **Severity:** **Medium**
- **Evidence:** `Live observed` and `Code verified`
- **Expected behavior:** Legal content uses reusable readable-content styles; auth feedback is announced; theme behavior is predictable.
- **Recommended solution:** Create PublicHeader, LegalDocument, and AuthStatus components; add `role="status"`/`aria-live`; expose or clearly honor the saved theme.
- **Difficulty:** Easy to Medium
- **Estimated UX impact:** Medium

### UX-23 — Offline and degraded-network behavior is undefined

- **Location:** Entire authenticated workspace
- **Description:** The product depends on many APIs and integrations but provides no coherent offline indicator, queueing policy, stale-data status, or retry center.
- **Why it hurts UX:** Mobile users can mistake connectivity failure for data loss or an empty account.
- **Who is affected:** Mobile, intermittent-network, and traveling users
- **Severity:** **Medium**
- **Evidence:** `Code verified`; offline runtime behavior requires validation
- **Expected behavior:** Users can distinguish offline, stale, syncing, and failed states and know which actions are safe.
- **Recommended solution:** Add global connectivity status, per-resource freshness, safe retry, and explicit offline capability boundaries. Do not claim offline support until writes are durable.
- **Difficulty:** Hard
- **Estimated UX impact:** Medium to high

### UX-24 — Internationalization and long-content resilience are not designed

- **Location:** Entire application
- **Description:** Interface strings are hardcoded, several compact layouts depend on short English labels, and dynamic records use truncation without always offering full accessible text.
- **Why it hurts UX:** Translation, long names, localized dates, and 200% text expansion can break hierarchy and controls.
- **Who is affected:** International users, zoom users, and users with long account/project names
- **Severity:** **Low**
- **Evidence:** `Code verified`
- **Expected behavior:** Components tolerate expansion and strings are externalizable.
- **Recommended solution:** Introduce message keys, use locale-aware formatters consistently, avoid fixed label widths, and test pseudo-localized text at 30–50% expansion.
- **Difficulty:** Hard
- **Estimated UX impact:** Strategic; currently low immediate reach

## 5. Screen-by-screen findings matrix

This matrix ensures every route and major checklist category is covered. Issue IDs contain the full recommendation.

| Screen | Primary UX risks | Related issues |
|---|---|---|
| Landing | Dense proof content, small targets, claims needing verification, no direct product sandbox | UX-03, UX-11, UX-20 |
| Login | Status announcements, target sizing, trust/context around Google authentication | UX-03, UX-11, UX-14, UX-22 |
| Signup | Same as login; password rules and failure recovery require runtime validation | UX-03, UX-14, UX-16, UX-22 |
| Onboarding | Minimal orientation and no first-value path | UX-20, UX-21 |
| Privacy | Inline layout, legal readability, claims requiring legal/security confirmation | UX-03, UX-11, UX-22 |
| Terms | Inline layout, small controls, integration language maintenance | UX-03, UX-11, UX-22 |
| Header | Search scope mismatch, route focus, popup keyboard model | UX-04, UX-09, UX-13 |
| Sidebar | Hover-dependent labels, flat IA, naming | UX-02, UX-12 |
| Dashboard | Dense first-use experience, drag accessibility, loading/empty states | UX-08, UX-15, UX-20, UX-21 |
| Stats | Visual-only data comparisons, no timeframe controls, empty/source clarity | UX-19, UX-21 |
| Todo | Modal focus, filters not persistent, small row actions | UX-01, UX-03, UX-17 |
| Calendar | Dead CTA, mobile grid density, panel focus, mixed record semantics | UX-01, UX-05, UX-09, UX-18 |
| Mail | Unsaved compose loss, row semantics, async/loading states, pagination density | UX-07, UX-09, UX-14, UX-15 |
| Chats | Connection dependency, split-view mobile complexity, async/empty states | UX-14, UX-15, UX-21 |
| Competitive Coding | Dense filtering and small metadata; source configuration separated into Settings | UX-03, UX-10, UX-17 |
| Hackathons | Modal focus, filter persistence, destructive action clarity | UX-01, UX-06, UX-17 |
| Projects | Progressive disclosure hides actions; modal/destructive patterns; filters reset on leave | UX-01, UX-06, UX-17 |
| Project detail | External-action hierarchy, destructive confirmation, progress semantics | UX-06, UX-19 |
| Jobs | Dense status/filter workflow, modal focus, destructive confirmation | UX-01, UX-06, UX-17 |
| Documents | Multiple import/create paths, permission failure complexity, modal focus | UX-01, UX-14, UX-16, UX-21 |
| Document opener | Missing-document recovery and save-state communication | UX-14, UX-16 |
| Profile | Recreated modal and save feedback | UX-01, UX-14 |
| Settings | Extreme length, risky disconnect placement, permission and account complexity | UX-01, UX-06, UX-10, UX-11 |
| Notifications | Custom button-like rows, immediate dismiss without undo, panel focus | UX-01, UX-06, UX-09 |

## 6. Checklist coverage

| Audit area | Result |
|---|---|
| Navigation / IA / discoverability | Flat IA, pointer-dependent sidebar, no route focus, misleading search scope |
| Visual hierarchy / layout / spacing / alignment | Improved symmetry baseline, but dense metadata and tiny type weaken hierarchy |
| Typography / readability | Repeated 8–11px text is below a comfortable product baseline |
| Color / contrast / dark mode | Monochrome system is consistent; exact contrast requires component-level manual testing in both themes |
| Buttons / inputs / forms | Target sizing, dialog focus, async state, validation and destructive roles need standardization |
| Search / filtering / lists / cards | Local filters work but do not persist; global search is page-only; custom rows vary semantically |
| Dropdowns / dialogs | Custom patterns need a unified keyboard model; modal primitive is the highest accessibility risk |
| Loading / empty / error / success | Present but inconsistent; skeletons, recovery actions, and announcements are incomplete |
| Notifications / feedback | Useful concept, but custom row semantics, focus management, and undo are weak |
| Keyboard / screen reader / ARIA | Mixed quality; some labels and handlers exist, but no systemic route or modal focus strategy |
| Touch / mobile / tablet / desktop | No public overflow; target sizing and authenticated calendar/split-view density remain risks |
| Scrolling / zoom / font scaling | Public pages reflow at 320px; authenticated dense layouts require 200% zoom testing |
| Performance perception | Build succeeds; initial and data loading lack stable skeleton structures |
| Animation / microinteractions | Reduced-motion override exists; hover/transform effects should be checked for purpose and focus parity |
| Onboarding / learnability | Does not establish a first-value path or workspace mental model |
| CTA / affordance | Calendar dead CTA is severe; integration and destructive actions have ambiguous hierarchy |
| Cognitive load / decision fatigue | Settings and flat navigation expose too many equal choices |
| Trust / permissions / security UX | Specific claims and broad integrations require clearer scopes, retention, and revocation explanations |
| User control / error prevention / recovery | Generic confirms, unsaved compose loss, direct disconnects, inconsistent retry |
| Data density / dashboard / charts | Dashboard is customizable but demanding; charts need data equivalents |
| Profile / account management | Profile is straightforward; account/integration management is overloaded |
| Offline / network / edge cases | Network failures exist, but no coherent degraded-state model |
| Design system / component reuse | Tokens and shared UI exist, but dialogs, legal content, statuses, and action rows are duplicated |
| Internationalization | Not currently designed; hardcoded strings and compact controls create future risk |
| Tables | Not materially used; list/card semantics are the relevant equivalent |
| Skeleton screens | Largely absent |
| Permissions | OAuth connections exist; scopes and consequences need clearer product copy |

## 7. Nielsen heuristic evaluation

| Heuristic | Score | Deductions |
|---|---:|---|
| 1. Visibility of system status | 5/10 | Inconsistent live announcements, loading models, freshness, and success feedback |
| 2. Match between system and real world | 6/10 | Familiar task/project/calendar concepts; “Mails,” “Setting,” source terminology, and integration states reduce clarity |
| 3. User control and freedom | 4/10 | Unsaved compose loss, inconsistent undo, risky disconnect placement, weak modal focus/exit model |
| 4. Consistency and standards | 5/10 | Shared visual language exists; dialogs, clickable rows, statuses, and public legal styling diverge |
| 5. Error prevention | 4/10 | Generic destructive confirms, dead CTA, accidental backdrop dismissal, weak dirty-state handling |
| 6. Recognition rather than recall | 5/10 | Hover-hidden navigation labels and flat IA require icon and destination recall |
| 7. Flexibility and efficiency | 6/10 | Command shortcut and filtering help; state is not persistent and drag workflows lack keyboard parity |
| 8. Aesthetic and minimalist design | 6/10 | Monochrome consistency helps; navigation and settings expose too many equal-priority elements |
| 9. Recognize, diagnose, recover from errors | 4/10 | Raw API messages and inconsistent retry/reconnect paths do not support diagnosis |
| 10. Help and documentation | 3/10 | Landing FAQ exists, but contextual setup, permissions guidance, and feature help are sparse |

**Heuristic average: 4.8/10.**

## 8. WCAG 2.2 assessment

This is a risk assessment, not a conformance declaration.

| Area / criterion | Assessment | Evidence and required action |
|---|---|---|
| 1.1.1 Non-text Content | Partial | Most Lucide icons accompany text or labels; decorative and status icons need a systematic `aria-hidden` review |
| 1.3.1 Info and Relationships | At risk | Visual dialogs and custom rows are not consistently represented by native semantics |
| 1.3.2 Meaningful Sequence | Public pass; authenticated review needed | Public heading order had no automated skips; overlays and complex settings require AT review |
| 1.4.3 Contrast (Minimum) | At risk | Muted 8–11px text and low-contrast borders require measured component-state testing |
| 1.4.4 Resize Text | At risk | Responsive widths work publicly, but fixed compact layouts and tiny metadata need 200% testing |
| 1.4.10 Reflow | Public pass; authenticated at risk | No public overflow at 320px; calendar intentionally scrolls horizontally |
| 1.4.11 Non-text Contrast | At risk | Focus, borders, status chips, and icon controls need 3:1 state contrast measurement |
| 1.4.12 Text Spacing | Untested | Run WCAG text-spacing overrides across authenticated routes |
| 1.4.13 Hover or Focus Content | At risk | Sidebar is hover-triggered and does not expose equivalent focus behavior |
| 2.1.1 Keyboard | At risk | Custom rows and drag/resize workflows are inconsistent |
| 2.1.2 No Keyboard Trap | At risk in opposite direction | Modals do not trap focus, allowing escape into background content |
| 2.4.1 Bypass Blocks | Likely fail | No skip link |
| 2.4.2 Page Titled | At risk | Custom routing does not expose route-specific document titles |
| 2.4.3 Focus Order | At risk | Route changes and overlays do not manage focus consistently |
| 2.4.7 Focus Visible | Partial | Global focus must be manually checked; several custom controls rely on subtle borders/shadows |
| 2.4.11 Focus Not Obscured | At risk | Fixed header, drawers, and uncontained overlays require keyboard verification |
| 2.5.3 Label in Name | Partial | Most labeled controls match visible text; icon-only and custom controls need voice-control testing |
| 2.5.8 Target Size (Minimum) | Likely fail in multiple components | Live measurements found numerous controls below 24px in one dimension |
| 3.2.3 Consistent Navigation | Partial | Sidebar is consistent after login; public/auth/workspace navigation patterns diverge |
| 3.3.1 Error Identification | Partial | Errors exist but are not normalized or always linked to their fields |
| 3.3.3 Error Suggestion | At risk | Raw backend messages often do not provide corrective action |
| 3.3.7 Redundant Entry | Untested | Multi-account and integration flows require live testing |
| 3.3.8 Accessible Authentication | Requires live validation | Password manager/paste/cognitive-test compatibility was not exercised |
| 4.1.2 Name, Role, Value | At risk | Shared modal and custom interactive containers are incomplete |
| 4.1.3 Status Messages | At risk | Status roles are inconsistent; password-reset info is plain text |

### Required assistive-technology test set

1. Keyboard-only journey through signup, onboarding, navigation, task creation/edit, filters, settings, and logout/delete.
2. NVDA + Chrome on Windows for route announcements, dialogs, form errors, data visualizations, and notifications.
3. VoiceOver + Safari/iOS for mobile drawer, calendar, mail/chat split views, and touch targets.
4. 200% browser zoom, 320 CSS px reflow, system text scaling, and WCAG text-spacing override.
5. Reduced motion, forced colors/high contrast, and dark mode.

## 9. UX scorecard

| Dimension | Score | Rationale |
|---|---:|---|
| Navigation | 5/10 | Broad coverage but flat IA, hidden labels, and no route focus |
| Visual design | 7/10 | Cohesive monochrome system and improved symmetry; tiny type and density remain |
| Usability | 5/10 | Core patterns are recognizable, but several actions and recovery paths are unreliable |
| Accessibility | 4/10 | Meaningful local effort, undermined by systemic modal, focus, target, and custom-control gaps |
| Performance perception | 6/10 | Fast public render and successful build; sparse skeleton/freshness communication |
| Consistency | 6/10 | Tokens and shared components exist; behavior patterns remain duplicated |
| Learnability | 5/10 | Familiar modules, weak onboarding and IA grouping |
| Efficiency | 6/10 | Shortcut/filter support, but no persistent views and limited keyboard parity |
| Trust | 5/10 | Legal/data content exists; claims and destructive/integration behavior need validation |
| Mobile experience | 5/10 | Public reflow is stable; touch sizing and authenticated dense views remain problematic |
| **Overall UX** | **5.4/10** | Capable product foundation with high-impact interaction and accessibility debt |

## 10. Root-cause analysis for major issues

| Issues | Root cause | Underlying design mistake | Long-term consequence | Business impact |
|---|---|---|---|---|
| UX-01, UX-09 | Page teams recreated interaction patterns locally | Visual component reuse was prioritized over behavioral contracts | Accessibility defects multiply with every feature | Higher remediation cost and exclusion risk |
| UX-02, UX-12 | Navigation grew feature by feature | Features were treated as destinations rather than grouped user goals | Findability degrades as modules increase | Lower activation and feature adoption |
| UX-03, UX-04 | Compact aesthetic became the default | Density was optimized before inclusive input/readability requirements | More target, zoom, and focus defects | Abandonment and accessibility exposure |
| UX-05 | Visual affordance shipped ahead of capability | Product state was not tied to control availability | Users cannot distinguish roadmap from broken UI | Reduced trust |
| UX-06, UX-07 | Destructive and dirty-state behavior is page-specific | Confirmation was treated as copy, not a risk system | Preventable data/work loss | Support burden and churn |
| UX-08 | Pointer library defined the interaction model | Drag was assumed to be the only customization mechanism | Power feature remains inaccessible | Excludes users and limits adoption |
| UX-10, UX-11 | Integrations accumulated in one management surface | Connection, permissions, accounts, and sources were not separated | Settings becomes harder and riskier with each integration | OAuth drop-off and trust concerns |

## 11. Quick wins

| Time budget | Improvement | Impact |
|---|---|---|
| <15 min | Rename “Mails” → “Mail” and “Setting” → “Settings” | Medium |
| <15 min | Relabel global search to “Go to page” | Medium |
| <15 min | Remove/disable Calendar “New event” with an explanatory label until implemented | High |
| <15 min | Add `role="status"` to password-reset success text | Medium |
| <30 min | Add route-specific document titles | Medium |
| <30 min | Add object names to destructive confirmation copy | High |
| <30 min | Stop backdrop dismissal for a non-empty mail draft | High |
| <1 hour | Add a skip link and focusable main-content target | High |
| <1 hour | Raise compact icon-button hit areas without enlarging icons | High |
| <1 hour | Add `aria-busy` and disabled state to common async submit buttons | Medium |
| <1 day | Give the shared modal dialog semantics, title IDs, initial focus, and focus restoration | Very high |
| <1 day | Add explicit sidebar expand/collapse control with persisted preference | High |
| <1 day | Introduce shared first-use, filtered, connected-empty, and error empty-state variants | High |
| <1 week | Complete focus containment/inert background across all modal variants | Very high |
| <1 week | Reorganize Settings into categorized subnavigation and per-integration management | Very high |
| <1 week | Add keyboard widget move/resize alternatives and announcements | High |

## 12. Component improvement recommendations

| Component | Required improvement |
|---|---|
| Sidebar | Explicit persisted toggle, focus expansion, grouped destinations, visible labels/tooltips |
| Header/navbar | Skip link, route titles/focus, correctly scoped command palette, popup keyboard model |
| Cards/lists | Native row controls, predictable action placement, larger metadata, consistent selected/loading states |
| Buttons | Size variants with minimum hit areas, pending state, destructive role, press feedback |
| Inputs/forms | Shared field description/error IDs, validation timing, dirty-state protection, password-manager testing |
| Modals/drawers | One primitive with semantics, containment, restoration, scroll lock, and dismissal policy |
| Search/filters | Explicit scope, keyboard navigation, URL/persisted state, active-filter count |
| Dashboard | Curated presets, accessible rearrangement, clearer first-use empty state |
| Charts | Text summary, timeframe/unit labels, accessible data table |
| Settings | Category navigation, per-integration manage screens, scope/permission summaries |
| Landing | Shorter proof path, verifiable claims, product walkthrough or safe demo |
| Authentication | Announced status, visible requirements, session/security explanation, accessible-auth testing |
| Notifications | Focus-managed panel, native rows, undo dismiss, grouped timestamps |

## 13. Design-system recommendations

- **Spacing:** Formalize a 4px base scale and name component padding/gap tiers. Do not use arbitrary one-off spacing.
- **Typography:** Establish minimum readable body/support sizes; reserve 9–11px for nonessential labels only when contrast and zoom behavior pass.
- **Color:** Keep the monochrome brand, but define semantic foreground/background pairs with measured light/dark contrast rather than color names such as `purple` or `success`.
- **Focus:** Add a global two-layer focus ring that remains visible on light, dark, and forced-color backgrounds.
- **Elevation:** Reduce simultaneous inset and lifted effects; elevation must communicate modality or hierarchy, not decorate every card.
- **Radius:** Limit to control, card, overlay, and pill tiers.
- **Icons:** Icons supplement text; icon-only controls require accessible names, tooltips where useful, and consistent hit regions.
- **Grid:** Standardize content widths, split-view minimums, card grids, and mobile collapse. Prefer agenda/list alternatives over horizontal panning for primary tasks.
- **Breakpoints:** Keep current width breakpoints but add behavior-based tests for navigation, split views, and 200% zoom.
- **Variants:** Define Button, IconButton, Field, Status, EmptyState, AsyncButton, Dialog, Drawer, Menu, and DestructiveConfirm contracts.
- **State management:** Separate server state from local UI state; preserve filters; model pending/success/failure/dirty states explicitly.
- **Motion:** Keep reduced-motion support and ensure hover animation has focus parity and a comprehension purpose.

## 14. Prioritized implementation roadmap

### Phase 1 — Critical fixes (1–2 weeks)

1. Replace/fix modal infrastructure and migrate all high-risk dialogs.
2. Remove or implement the dead Calendar CTA.
3. Protect non-empty mail drafts.
4. Add skip link and route focus/title management.
5. Raise minimum target sizes for global controls and primary workflows.

### Phase 2 — Important improvements (2–4 weeks)

1. Redesign sidebar expansion and navigation grouping.
2. Standardize destructive/undo and async feedback patterns.
3. Reorganize Settings and integration management.
4. Replace custom clickable containers with native/composite patterns.
5. Provide accessible dashboard customization.

### Phase 3 — Quality improvements (3–5 weeks)

1. Persist filters and views.
2. Add structured loading, empty, error, and data-visualization alternatives.
3. Create mobile calendar agenda and improve split-view behavior.
4. Validate and revise security/privacy/permission copy.

### Phase 4 — Delight improvements (ongoing)

1. Goal-based onboarding and setup checklist.
2. Federated command palette.
3. Offline/degraded-network model.
4. Internationalization and pseudo-localization.
5. User research: first-run usability test, navigation tree test, and diary study for recurring workflows.

## 15. Final action plan

| Priority | Issue | Severity | Estimated effort | UX impact | Recommended fix | Status |
|---:|---|---|---|---|---|---|
| P0 | UX-01 Dialog infrastructure | Critical | Medium | Very high | Unified semantic, focus-contained modal | Implemented |
| P0 | UX-05 Dead Calendar CTA | High | Easy/Hard | High | Remove/clarify now; implement event flow later | Implemented: clarified read-only behavior |
| P0 | UX-07 Unsaved mail loss | High | Medium | High | Dirty-state protection and draft recovery | Implemented |
| P0 | UX-03 Target size/readability | High | Medium | Very high | Control/type scale and 24/44px testing | Implemented |
| P0 | UX-04 Bypass/route focus | High | Medium | High | Skip link, titles, focus on navigation | Implemented |
| P1 | UX-02 Hover-dependent sidebar | High | Medium | High | Explicit persisted expansion control | Implemented |
| P1 | UX-06 Destructive action safety | High | Medium | High | Named confirms, destructive role, undo | Partially implemented |
| P1 | UX-09 Custom interactive semantics | High | Medium | High | Native controls and composite patterns | Not started |
| P1 | UX-10 Settings overload | High | Hard | Very high | Categorized settings and Manage flows | Partially implemented |
| P1 | UX-08 Dashboard drag accessibility | High | Hard | High | Keyboard move/resize and announcements | Not started |
| P1 | UX-11 Trust/security substantiation | High | Medium | High | Legal/security data-map review | Not started |
| P2 | UX-12 Flat IA and terminology | Medium | Medium | High | Intent-based groups and naming | Implemented |
| P2 | UX-14 Async feedback | Medium | Medium | High | Shared pending/success/error patterns | Partially implemented |
| P2 | UX-16 Error recovery | Medium | Medium | High | Error taxonomy and recovery actions | Not started |
| P2 | UX-20 Onboarding mental model | Medium | Hard | Very high | Goal-based first-value journey | Not started |
| P2 | UX-21 Empty-state actionability | Medium | Medium | High | Shared cause-specific empty states | Not started |
| P2 | UX-18 Mobile calendar | Medium | Hard | High | Agenda-first narrow-screen design | Implemented |
| P2 | UX-19 Accessible charts | Medium | Medium | High | Summaries and data tables | Implemented |
| P2 | UX-13 Search scope | Medium | Easy/Hard | Medium–High | Relabel now; federate later | Implemented: relabeled |
| P2 | UX-15 Loading structure | Medium | Medium | Medium–High | Stable skeleton and freshness states | Not started |
| P2 | UX-17 Persistent filters | Medium | Medium | Medium–High | URL/persisted view state | Implemented |
| P3 | UX-22 Public/legal consistency | Medium | Easy–Medium | Medium | Shared legal/auth components | Implemented |
| P3 | UX-23 Offline behavior | Medium | Hard | Medium–High | Connectivity/freshness/retry model | Partially implemented |
| P3 | UX-24 Internationalization | Low | Hard | Strategic | Message extraction and expansion tests | Not started |

## 16. Standards and references

- [Web Content Accessibility Guidelines (WCAG) 2.2](https://www.w3.org/TR/WCAG22/)
- [W3C Understanding WCAG 2.2](https://www.w3.org/WAI/WCAG22/understanding/)
- [W3C: Target Size (Minimum), SC 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
- [W3C: Focus Appearance, SC 2.4.13](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html)
- [Apple Human Interface Guidelines: Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)
- [Apple Human Interface Guidelines: Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons)
- [Material Design 3: Accessible design](https://m3.material.io/foundations/accessible-design/overview)
- [Nielsen Norman Group: 10 Usability Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/)

---

### Recommended research follow-up

Run five moderated task-based sessions split across a first-time student, returning developer, competitive-programming user, mobile-only user, and keyboard/screen-reader user. Test signup, first task, calendar comprehension, project/job update, integration connection/revocation, mail draft recovery, and account deletion. Use the results to validate severity and reorder Phase 2–4 work.
