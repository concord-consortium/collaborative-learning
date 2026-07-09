# AI Chat Tutor Sidebar in CLUE (Spike)

**Jira**: https://concord-consortium.atlassian.net/browse/CLUE-566
**Repo**: https://github.com/concord-consortium/collaborative-learning
**Implementation Spec**: [implementation.md](implementation.md)
**Verification Notes**: [verification-notes.md](verification-notes.md)
**Status**: **Implemented** (see [implementation.md](implementation.md); deployment preconditions
remain operational gates)

## Overview

<!-- Rewritten during Finalization -->
A time-boxed spike that adds an opt-in AI chat tutor to CLUE, opened from a button in the app header,
that helps a student reason about the work in front of them. It ports the per-page AI chat tutor built
for the Activity Player (AP-118, frontend) and the report-service (REPORT-73, backend), adapting both to
CLUE's document model, identity model, and styling. The goal is to learn whether a contextual,
document-aware tutor is useful in CLUE — **not** to ship a production feature.

## Project Owner Overview

<!-- Rewritten during Finalization -->
CLUE is experimenting with AI approaches and infrastructure. This spike replicates the tutoring
interaction and guidance already prototyped in the Activity Player so we can evaluate it inside CLUE's
collaborative document environment. A student in a unit that has the feature enabled gets a tutor they
can open from the app header; it sees the curriculum content they are working from and the document
they are producing, and coaches them toward their own reasoning without handing over answers. Because it
is a prototype, it is off by default (enabled by a URL query param), and intended for pilot/test data
only — no real student PII, pending a FERPA/PII + retention review.

## Background

The Jira ticket (CLUE-566, "SPIKE: AI chat in CLUE Discussions") originally proposed adding an "AskAI"
button to CLUE's existing comment/Discussions UI. **Per direction from the project owner, that placement
is superseded**: instead of living in the comments UI, this spike ports the **sidebar overlay UI** from
the Activity Player story **AP-118** (`activity-player`, branch `AP-118-add-chat-sidebar`) and opens it
from a **button in the CLUE app header**, with the sidebar restyled to match CLUE. The backend is ported
from the report-service story **REPORT-73** (`report-service`, branch `REPORT-73-chat-tutor-backend`)
into CLUE's own Firebase functions.

The two source implementations are richly documented; the AP-118 spec
(`activity-player/specs/AP-118-chat-sidebar-spike.md`) is the primary design reference. This CLUE port
keeps their hard, already-solved parts — the async Firestore transport, the per-conversation lock/drain
engine, the security-rule shape, and the accessibility bar — and diverges only where CLUE's world differs
from AP's:

- **There is no external resource to fetch.** AP's function fetches an authored activity page from a
  public LARA URL (SSRF-hardened, cached) and assembles the system prompt server-side. CLUE has no such
  fetchable artifact — the tutor's context is **CLUE documents** that already live in the client's MST
  state (and in Firebase). So AP's entire server-side fetch/convert path is dropped.
- **Context is dynamic.** AP pages are static authored content, so AP installs the page context **once**
  as a persistent **developer-role conversation item** (AP's `openai.ts` is explicit it is *not* the OpenAI
  `instructions`/system-prompt surface). CLUE documents are **actively edited by the student during the
  conversation**, so the tutor's context must **refresh as the document changes**.
- **Two panels, not one.** AP had a single authored page. CLUE shows the curriculum/resource on the left
  ("Lessons and Documents") and the student's own work on the right ("Workspace"). The tutor needs both.
- **Different identity + storage model.** AP keys conversations on `run_key`/`learnerKey`; CLUE uses a
  class/offering/user model with portal JWT claims. The Firestore path and security rules are re-modeled
  on CLUE's existing comments/documents structure.

### Reference: how the AP/report-service tutor works (ported skeleton)

- The browser writes a `user` message doc to a per-conversation Firestore path; an **`onWrite` Firestore
  trigger** composes a system prompt, calls OpenAI, and writes the **complete** assistant reply as one doc
  (no streaming). The sidebar's `onSnapshot` subscription renders it. Reload rehydrates from Firestore.
- A **per-conversation single-in-flight lock** (Firestore transaction compare-and-set `idle → generating`)
  plus a **drain step** processes messages in order; a **self-trigger guard** ignores the function's own
  `assistant` writes. Per-conversation state (`conversationId`, `status`, drain cursor) lives on a parent
  doc, read fresh each invocation — no in-memory state.
- The OpenAI key stays server-side; the model uses the **Responses + Conversations API** (conversation
  state on OpenAI; only the new turn is sent) with a **strict `json_schema` structured reply**.
- The frontend is transport-abstracted (`ChatTransport`): a `DebugTransport` renders "what would be sent"
  with no backend, and a `FirestoreTransport` is the live path — so the entire UI is buildable and
  reviewable before any backend exists.

## Requirements

### Frontend — sidebar UI ported from AP-118

- **App-header launcher.** A button in the CLUE app header (`src/clue/components/clue-app-header.tsx`,
  `.right` region) opens the tutor sidebar. Shown only when the `chatTutor` URL param is on, **the user is a
  student** (see Resolved Questions), **and a workspace document is open with its content loaded** — i.e.
  `persistentUI.problemWorkspace.primaryDocumentKey` is defined **and**
  `documents.getDocument(primaryDocumentKey)?.content` exists (IC-5 + ER-3). **Gating on a *loaded* document, not
  just a restored key,** avoids two failure modes: a keyless conversation (the key is `types.maybe`), and a
  summarizer crash — `DocumentModel.content` is **also** `types.maybe` (`document.ts:69`) and can be undefined
  after `PersistentUI` restores a `primaryDocumentKey` but before the `DocumentModel` loads, and
  `documentSummarizer(undefined, {})` **throws** ("Failed to parse content", `ai-summarizer.ts:89-94`). So RIGHT
  summarization/send must not be enabled until `content` is present; the tutor simply isn't available (or shows a
  brief loading state) until the student's workspace document has loaded. Styled to match CLUE's header, not AP's
  floating pill.
- **Sidebar overlay.** Port AP's overlay-drawer sidebar (`activity-player/src/components/chat/`:
  `chat.tsx`, `chat-sidebar.tsx`, and SCSS) as a right-edge drawer, landing under a **new
  `src/components/chat-tutor/` directory** (NOT `src/components/chat/`, which is already CLUE's existing
  comment "chat panel" feature — see Technical Notes). **Restyle to CLUE's design
  system** (CLUE SCSS variables/tokens), replacing AP's `vars.scss` colors. Reuse the presentational
  `Chat` component (composer, message list, typing indicator, copy-transcript, error row) largely as-is.
  - **Post-implementation change (2026-07-09): non-overlaid, inline sidebar.** In AP the drawer
    *overlays* the activity content; that read poorly in CLUE's denser two-panel layout. The shipped
    CLUE version instead **reserves width and reflows** — the workspace shrinks and the drawer sits
    beside it as a third column, never covering content. Mechanics: drawer open state moved from the
    header's local `useState` to an observable `ui.showChatTutor` flag so the layout can react; the
    `.chat-tutor-open` class on `.clue-app-content` adds a right margin to `.workspace` equal to the
    drawer width; the drawer itself is styled as a peer column (light-teal `section-heading-row`-style
    header with rounded top corners over a gray-bordered chat body) rather than a floating overlay.
- **Transport abstraction.** Port AP's `ChatTransport` **seam** (the interface) and provide a
  `DebugTransport` (no backend) and a live `FirestoreTransport`, so the UI is demoable before the backend
  lands. Note only the *interface* ports cleanly: AP's concrete transports are bound to AP infra (log-sink
  registration, AP page-context types, report-service prompt-file names in the debug narrative, AP's
  `/sources/{source}/.../pages/{pageId}` path), so both are **substantially rewritten** for CLUE's
  LEFT-JSON / RIGHT-markdown payloads and CLUE's Firestore keying.
- **Per-document, per-problem conversation.** One conversation per CLUE workspace document **within a
  problem/offering**, keyed by document key + user identity **+ `problemPath`** (ER-1). The canonical
  conversation doc id is **`networkDocumentKey(uid, documentKey, network) + "_" + escapeKey(problemPath)`** —
  `problemPath` is slash-delimited (`unitCode/inv/prob`) and `/` is a Firestore path separator, so it **must** be
  `escapeKey()`-ed before use in a doc id (ER-8; see Technical Notes), while the raw `problemPath` is also kept as
  a queryable field. Opening/switching documents swaps the conversation. **Including `problemPath` in the key is what keeps LEFT (the installed-once
  problem context) from going stale:** non-problem workspace docs — **personal documents and learning logs** —
  are reused across problems, so a document-key-only conversation would rehydrate an old transcript still
  carrying the *first* problem's LEFT. Keying on `problemPath` (available as `stores.problemPath` /
  `persistentUI.problemPath`) means opening the same reusable doc under a new problem starts a **fresh**
  conversation for which the installed-once LEFT is trivially static. Header makes the scope legible.
- **Two-panel context: LEFT installed once (JSON), RIGHT refreshed on change (markdown).** The two panels
  have different natures, so they are sent differently:
  - **LEFT — whole-problem context, sent once.** The current **problem** (the authored resource the
    student is reasoning about) is **static** within a conversation, so the client serializes it as **JSON** and
    attaches it to the **first** `user` message only; it is installed once and flagged on the parent doc
    (mirroring how the server-owned system prompt is installed once). **Granularity = the whole problem, not one
    section** — so it is unambiguously static for the conversation (a single "current section" would only capture
    wherever the student was at the first message). Note there is **no single `DocumentContentModel` for a whole
    problem**: a `ProblemModel` holds `sections: types.array(SectionModel)`, each section's `content` its own
    `DocumentContentModel` — so LEFT is built by **iterating `problemModel.sections[]`, calling
    `section.content?.exportAsJson()` per section** (null-checking the `types.maybe`), and **assembling a single
    structured wrapper — `{ sections: [{ type, title, content: JSON.parse(section.content.exportAsJson()) }] }`**
    — **not** raw string concatenation (ER-2): `exportAsJson()` returns a JSON *string*
    (`document-content.ts:141,231`), so concatenating several would yield invalid JSON; parse each into the
    wrapper (or, if a text envelope is preferred, say so explicitly and delimit it — but the structured object is
    the intent here). See Technical Notes. JSON is chosen over markdown here deliberately: the curriculum markdown path
    (`summarizeCurriculum`) is documented as low-quality (see Technical Notes), and a once-sent payload never
    accumulates additional copies (though, like all conversation content, it is re-billed each turn — so keep it
    reasonably small).
  - **RIGHT — workspace document, refreshed on change.** The student's **workspace document** is actively
    edited, so the client keeps a compact **markdown summary** of it, produced by `documentSummarizer` (named
    export, `shared/ai-summarizer/ai-summarizer.ts`; called with the live `document.content` node). **For the
    spike, use plain `documentSummarizer` — not `documentSummarizerWithDrawings` (FE-2):** the drawings variant
    statically imports the **code-split** Drawing plugin (+ `react-dom/server`), which an eager import from
    `chat-tutor/` would hoist into the main `index` bundle (see Technical Notes). The tutor therefore sees all
    non-drawing tile content but not drawing SVGs — an accepted spike limitation; a later tier can add drawings
    via a dynamic `import()` at send-time. **Recompute strategy — dirty-flag + compute-on-send, not a
    per-change observer (ER-7).** In CLUE a keystroke in a tile *is* an MST content mutation, so "recompute on
    document change, not on keystroke" is a false distinction (they are the same event) — a naive observer on
    `document.content` would recompute the full summary on every character. Instead: a **cheap dirty flag** is set
    by a lightweight `onPatch`/reaction on `document.content` that **only flips a boolean** (no serialize), and
    the **expensive `documentSummarizer` recompute happens lazily at send time, only if dirty** — sends are
    user-initiated and infrequent, so at most one full serialize+parse+normalize per send, and none when the
    document is unchanged since the last summary. On each `user` send: if dirty, recompute the summary + hash and
    clear the flag; then compare the current summary's hash to the last RIGHT summary sent in this conversation
    and **attach it only if the hash differs**. If unchanged, no RIGHT payload is attached and the tutor reuses
    the summary already in its conversation; if changed, the fresh markdown refreshes it. (The hash compare is a
    second gate: a content edit that normalizes to the same summary — e.g. a typo typed then deleted — flips the
    dirty flag but produces an identical hash, so nothing is re-sent.) Markdown keeps each refresh small, which
    matters because refreshes accumulate in the OpenAI conversation.
  - Context (LEFT or RIGHT) is **never** attached to a forwarded-log doc — only to `user` messages.
- **CLUE-appropriate empty state.** Reword AP's empty-state/placeholder copy for CLUE's document framing
  (orient the student to *their work*, e.g. "Ask the tutor about your work" rather than "this page").
  Heavier expectation-setting (the coaches-not-answers stance) is left to the tutor's own replies, which
  the server-owned generic prompt already enforces — no onboarding UI needed for the spike.
- **Accessibility bar (adopted from AP as in-scope):** labeled composer + accessible send button,
  per-turn sender attribution in the DOM, a single `aria-live="polite"` region announced on
  assistant-message completion, an AT-exposed typing indicator, keyboard focus management for the
  drawer (focus in on open, restore to launcher on close), and a surfaced error row (never an infinite
  spinner).
- **CLUE accessibility integration (beyond porting AP's bar):**
  - **Contrast checked, not assumed.** The CLUE restyle must meet **WCAG AA contrast** on the launcher,
    composer, and message bubbles — verified against CLUE's palette, not just color-matched by eye.
  - **Integrate with CLUE's keyboard navigation (launcher is a plain Tab stop for the spike).** The CLUE
    header calls `useClueAccessibility({ type: "region", navigation: { itemSelector: "button, …" } })` on
    `headerRef` (`clue-app-header.tsx:39-46`), but that call is **not currently wired for arrow-key roving**:
    the header discards the hook's return value and attaches no `onKeyDown`/roving `tabIndex`, and the
    package's `useKeyboardNav` only *returns* a `handleKeyDown` (it does not self-attach a listener — verified
    against the installed dist, `dist/hooks/index.js:922`, `:1259-1289`). So a `<button>` launcher dropped into
    `.right` is **not** auto-captured as an arrow stop; it is simply the next **Tab** stop in the header's DOM
    order — which is fully accessible and sufficient for the spike. (Wiring the header region for arrow-key
    roving is out of scope here; if the separate in-progress CLUE keyboard-nav work lands it later, the
    launcher would inherit that behavior for free.) One thing that still matters: **do not use `disabled` as
    the launcher's busy state** — reflect "generating" some other way (e.g. `aria-disabled` handled in the
    click path, or a spinner) so the control never becomes a non-actionable focus stop.
  - **Drawer focus management via the accessibility package (using its verified hook contract).** Use the
    package's **`useFocusTrap`** hook (`@concord-consortium/accessibility-tools/hooks`) for the drawer's
    **Tab/Shift+Tab containment and Escape** — AP itself has **no** focus containment (it only does
    focus-in-on-open + restore-on-close), so this is a *new* capability, not a port of AP's Tab handling.
    Verified contract the implementation must follow (checked against the **installed** dist
    `@concord-consortium/accessibility-tools@0.1.0-pre.1`):
    - **`enabled` is a no-op in the hook** — only the `FocusTrapController` *class* honors it; the hook
      installs its document-level `keydown`/`focusin` listeners (`dist/hooks/index.js:379-381`) whenever it is
      called with a config and a mounted `containerRef`. **So gate the trap by config presence, not `enabled`:**
      call `useFocusTrap(undefined)` while the drawer is closed (the hook early-returns `null` at `:419` and
      installs no listeners) and pass the real `{ containerRef, strategy }` only while open, then `enterTrap()`
      on open. (Unmounting the drawer when closed is an equivalent alternative.)
    - **`enterTrap()` must run on EVERY open, mouse or keyboard (A11Y-3).** When the config becomes defined the
      hook's mount effect calls `setChildrenNonTabbable()` (`dist:223-225`), setting `tabindex="-1"` on every
      focusable descendant; tabbability is only restored inside `enterTrap()`. If `enterTrap()` were gated to
      keyboard-initiated opens, a mouse click that opens the drawer would leave the composer and all controls
      unreachable by keyboard and never set initial focus. So call `enterTrap()` on every open, after the mount
      effect has run.
    - **SR announcements and initial focus are strategy-driven, not automatic.** Announcements fire only when
      the strategy supplies `announceEnter`/`announceExit`; `enterTrap()` focuses the first `cycleOrder` slot,
      **not** the composer — so the drawer's strategy must place initial focus on the composer explicitly.
    - **Close + launcher-restore must NOT rely on plain `onExit` (A11Y-2).** On both the Escape path and
      `exitTrap()`, the hook runs `strategy.onExit?.()` and then **unconditionally** `container.focus()`
      (`dist:302`→`:308`, `:442`→`:444`) — so a `launcher.focus()` performed inside `onExit` is immediately
      overwritten by the trap focusing its own container. To land focus on the launcher, either return
      `"handled"` from an `escapeHandlers[slot]` (which **skips** the exit + `container.focus()`, `:293-297`) and
      close + restore focus yourself, or tear down by **unmounting** the drawer (the cleanup path calls `onExit`
      with **no** `container.focus()`, `:412-418`).
    - **Version directive:** build and test against the **installed** `0.1.0-pre.1` contract (or later); if using
      a linked local working copy (`yalc link`), upgrade it to **≥`0.1.0-pre.1` first** — the older
      `~/projects/accessibility-tools` `0.0.1-pre.1` hook does **not** invoke `escapeHandlers` at all, so
      Escape-to-close silently won't fire there.
    - The trap handles **containment** only: the **focus-in-on-open** and **restore-focus-to-launcher-on-close**
      round-trip is **drawer-owned** (the trap restores focus to its container, not to an external launcher) —
      see the A11Y-2 note above for how to keep the trap from clobbering the launcher restore.
    Acceptance behaviors: launcher reachable as a Tab stop in the header (not disabled while busy); drawer
    Tab-containment via `useFocusTrap` (config-gated, not `enabled`-gated); composer focused on open; focus
    restored to the launcher on close.

### Backend — faithful port of REPORT-73 into CLUE `functions-v2` (1st-gen trigger via `firebase-functions/v1`)

- **`onWrite` trigger + lock/drain (machinery reused nearly verbatim).** Port REPORT-73's 1st-gen
  `onWrite` Firestore trigger and its lock/drain **machinery** (`chat-tutor.ts`, the lock/drain/cursor
  logic in `chat/drain.ts`, and `chat/openai.ts`) into CLUE's **`functions-v2`** codebase, keeping the
  1st-gen trigger shape verbatim by importing from **`firebase-functions/v1`** (verified: `firebase-functions@5.1.1`
  in `functions-v2` re-exports `v1.firestore.document(...).onWrite` and `v1.runWith({secrets})` — see the
  resolved codebase question). These port with minimal change. Preserve: self-trigger guard, per-conversation
  compare-and-set lock with stale reclaim, ordered drain with a tie-safe `{createdAt, messageId}` cursor,
  and the crash-safe atomic commit of assistant doc + cursor. `openai.ts` ports verbatim **after an `openai`
  SDK upgrade** (see the OpenAI bullet + Risks: `functions-v2` is on `openai@^4.64`, which lacks the
  Responses/Conversations API the port uses).
  - **Keep the ported trigger 1st-gen.** It runs correctly only under the 1st-gen **default no-retry**
    policy (its own comment warns of an infinite re-drain otherwise), so do **not** "modernize" it to a
    2nd-gen `onDocumentWritten` trigger (at-least-once / Eventarc). Set an explicit region (1st-gen defaults
    to `us-central1`, unlike `functions-v2`'s 2nd-gen functions), and expect minor lint/TS fixups on paste
    (`functions-v2`'s `tsc` build is `strict` + `noUnusedLocals`).
- **Context assembly is new CLUE-specific code (not a verbatim port).** The context-composition half of
  `drain.ts` (`composePageSystemPrompt` and its deps `fetch-activity.ts`, `convert.ts`, `page-walk.ts`,
  `chat-context.ts`, `sim-prompts.ts`) is **deleted**, not ported — CLUE has nothing to fetch. In its
  place, new code reads the **client-written context payloads** off the `user` message doc — the LEFT
  problem JSON (on the first message) and/or the RIGHT workspace markdown (when changed) — and composes the
  conversation context from them plus the server-owned generic tutor prompt. Expect this to be the main
  net-new backend work; the lock/drain machinery above is the reused part.
- **LEFT installed once, RIGHT refreshed on change.** The LEFT problem JSON arrives on the first `user`
  message and is **installed once** into the conversation (flagged on the parent doc, like the system-prompt
  install), never re-sent. The RIGHT workspace markdown is **refreshed when the client sends a new one**
  (i.e. when its hash changed); a `user` message with no RIGHT payload reuses the summary already present.
  So the workspace context updates only when it actually changes, and the static problem context costs one
  install, not one-per-turn.
  - **LEFT install mechanism (inlined — IC-2).** Install LEFT **once** as a persistent **developer-role
    conversation item** on the OpenAI conversation, on the first `user` message — the same surface REPORT-73
    uses for the server-owned prompt (`installDeveloperPrompt` in `report-service`'s `openai.ts`/`drain.ts`),
    **not** the OpenAI `instructions`/system-prompt field. Set a `problemInstalled` (or equivalent) flag on the
    parent doc after installing, and skip re-installing on later turns. (Mirrors REPORT-73's system-prompt
    install; a fresh dedicated developer item is chosen over re-editing an existing item because the
    Conversations API appends rather than mutates.)
- **Latest-context-wins framing (RIGHT only — envelope inlined, IC-2).** Because RIGHT workspace summaries
  accumulate in the OpenAI conversation (a new summary does not remove earlier ones), each RIGHT payload is
  wrapped in an **envelope** that makes the newest authoritative. Concrete shape: a header line
  `CURRENT WORKSPACE — supersedes all earlier workspace summaries (seq=<n>, ts=<ISO-8601>)` followed by the
  markdown summary, where `<n>` is a per-conversation monotonically increasing integer (persisted on the parent
  doc) and `<ts>` a send timestamp. The generic tutor prompt is worded to trust the highest-`seq` workspace
  summary and disregard earlier ones. LEFT is sent once, so it neither accumulates nor goes stale (no envelope
  needed).
- **OpenAI Responses + Conversations API (requires an `openai` SDK upgrade in `functions-v2`).** Reuse
  REPORT-73's `openai.ts` — developer-role prompt, `conversationId` on the parent doc, strict `json_schema`
  reply — but note it ports **verbatim only after upgrading `functions-v2`'s `openai` dependency**.
  REPORT-73 builds on `openai.conversations.*` + `openai.responses.create({conversation, store:true})`
  against **`openai@^6.45`**; `functions-v2` currently pins **`openai@^4.64`**, where `openai.responses` and
  `openai.conversations` are **`undefined`** (verified by executing the installed SDK) — a verbatim paste
  throws at the first call. **Backend prerequisite:** bump `functions-v2` `openai` to `^6.x` (matching
  report-service) and verify the bump does not break the existing LangChain path
  (`get-ai-content.ts` / `on-class-data-doc-written.ts` run through `@langchain/openai@^0.6.7`, which pins
  its own nested `openai@5.12.2`). Keep the OpenAI key server-side via **`defineSecret("OPENAI_API_KEY")`**
  (the exact pattern already used in `functions-v2`, e.g. `functions-v2/src/get-ai-content.ts`), model id as
  config (REPORT-73 uses `defineString("OPENAI_MODEL")`, provisioned per environment). Note this
  raw-`openai`-SDK Responses/Conversations surface is **net-new to CLUE** and differs from CLUE's existing
  LangChain `ChatOpenAI` (chat.completions) integration — an accepted spike divergence (see Self-Review
  Pass 2).
- **Generic tutor prompt (server-owned).** Port `CHAT_GENERIC_PROMPT` (the tutoring stance,
  never-reveal-answers rule, and science-reasoning lens), adapting AP/activity wording to CLUE's
  document/tile context. *Amended (2026-07-09): unit authors can now optionally replace and/or
  append to this prompt per unit — see [prompt-authoring-plan.md](prompt-authoring-plan.md).*
- **Security rules.** Add **fresh** CLUE Firestore rules for the tutor chat's **own new collection(s)** —
  it does not reuse or extend the comment rules. Reuse REPORT-73's field-whitelisting **technique** (server-owned
  lock/cursor/conversation fields admin-only; `kind:'user'` + whitelisted payload on messages), but re-express it
  against CLUE's identity model and helpers (portal JWT claims / class-offering-user; `isAuthed()`,
  `userIsRequestUser()`). Templates, corrected against the actual rules file:
  - **Document shape — owner `uid` on *every* doc (parent and message), option A (ER-9).** The chat has two doc
    kinds: a **parent conversation doc** (server-owned state: `conversationId`, `status`, drain cursor,
    `problemInstalled` flag, RIGHT `seq`; plus `uid`, `context_id`, raw `problemPath` set at create) and
    **message docs** (`kind`, content payload, `createdAt`, optional LEFT/RIGHT context; plus `uid`). Because the
    chat reuses the **global** owner helpers `userIsRequestUser()` / `userIsResourceUser()`, which check `uid` **on
    the doc being created/read**, and because the client's `onSnapshot` **reads message docs (including
    server-written `assistant` docs) directly**, the owner `uid` must live on **every** doc — parent *and* each
    message — not only the parent. Client `user`-message creates set their own `uid` (pinned by
    `userIsRequestUser()`); the **server stamps the owner `uid` onto each `assistant` doc** (it writes via the
    admin SDK, bypassing rules, and knows the conversation owner) so the client's `userIsResourceUser()` read
    passes; `uid` is included in the message create whitelist. (Rejected alternative B — owner only on the parent,
    message rules `get()` the parent — was declined for the spike: it adds a Firestore `get()` per message
    read/create, i.e. an extra read per rendered message under `onSnapshot`.)
  - **Self-contained top-level collection (SEC-3 decision).** The tutor chat is a **top-level** collection
    under `/authed/{portal}/…` (its own root), **not** a subcollection of `documents/{docId}`. Rationale: it's a
    throwaway spike on the staging project — a top-level collection can be **deleted wholesale** to purge all
    chat data when the spike ends. Consequence for the rules: the owner/teacher/researcher **helpers**
    (`userOwnsDocument()`, `teacherCanAccessDocument()`, `researcherCanAccessDocument()`) are **lexically scoped
    inside `match /documents/{docId}`** (`firestore.rules:439,401,405`, each calling `get(.../documents/$(docId))`)
    and are therefore **out of scope** for a top-level collection — they **cannot** be reused as-is. **But the
    *global* owner helpers `userIsRequestUser()` / `userIsResourceUser()` (`firestore.rules:56-72`) are defined
    outside `match /documents` and *are* in scope (ER-6)** — the chat rules reuse them (they compare
    `string(request.auth.token.platform_user_id) == data.uid` against the chat doc's **own `uid` field**), rather
    than re-implementing a raw comparison. So ownership is checked locally on the chat doc's own `uid`, via the
    existing global helpers.
  - **Strictly owner-only, students-only read (SEC-5 + ER-4 + ER-6).** The **same** read rule applies to **both**
    the parent conversation doc and every message doc (the client `onSnapshot`-reads messages directly, ER-9), so
    each carries `uid` — `assistant` docs get theirs server-stamped (ER-9). The read rule is **owner-only and
    student-only**, using the **global** helper plus the correct role claim:
    `userIsResourceUser() && isStudentClaim()` — where `userIsResourceUser()` already does
    `string(request.auth.token.platform_user_id) == resource.data.uid` (`firestore.rules:68-72`; note the
    **`string(...)` cast** — `platform_user_id` is numeric, `portal-types.ts:100`, so a raw `==` against a string
    `uid` would fail, ER-6), and `isStudentClaim()` = **`hasRole("learner")`** (`hasRole(role)` =
    `request.auth.token.user_type == role`, `firestore.rules:31-32`). **Use `"learner"`, not `"student"` (ER-6):**
    the real Firebase token students carry has `user_type: "learner"` (`portal-types.ts:104`, the type whose
    comment says it is what Firestore rules see); the app remaps that to `user.type === "student"` **client-side
    only** (`auth.ts:268`, `user.ts:162`) — the rules never see the remap, so `hasRole("student")` would deny
    every real student. Requiring `isStudentClaim()` on read makes the students-only decision a **rules-enforced**
    invariant rather than a UI-only one, consistent with owner-only. **No teacher/researcher read branch** — consistent with the students-only /
    no-observer-UI design; evaluators inspect transcripts via the Firestore console/emulator (already the stated
    review method), and the spike is test-accounts-only so no real-student PII read surface is opened. **Do not**
    re-derive from the `documents` read rule: its `resourceInUserClass()` branch (`firestore.rules:352,177-179`)
    would let **any student in the same class** read another student's private transcript.
  - **Owner pinned + student-gated at create (SEC-4 + ER-4 + ER-6 — closes the read loop *and* the paid-trigger
    path).** The owner-only read rule trusts `resource.data.uid`, so the **create** rule **must** pin that field
    to the caller's own token via the **global** helper `userIsRequestUser()` — which already asserts
    `string(request.auth.token.platform_user_id) == request.resource.data.uid` (`firestore.rules:56-59`, the
    `string(...)` cast handling the numeric claim, ER-6) — **and additionally require `isStudentClaim()`**
    (= `hasRole("learner")`, **not** `"student"` — ER-6), on **both** the parent and message create. The
    student-role gate is **load-bearing, not cosmetic (ER-4):** the students-only decision is otherwise enforced
    **only** by the UI launcher's visibility, so without a rules-level role check a teacher or researcher could
    write a `kind:'user'` chat doc **directly** (the rules layer, not the hidden launcher, is the real boundary)
    and fire the paid OpenAI trigger. The claim is available server-side as `request.auth.token.user_type` (via
    `hasRole`, `firestore.rules:31-32`; real student value `"learner"`, `portal-types.ts:104`).
    Do **not** lean on CLUE's `documents` create rule (`firestore.rules:144-148`), which validates only
    `context_id`/`class_hash` and does **not** pin `uid` to the token — a chat doc created
    under that rule would carry a client-settable owner, defeating the owner-only read. (The source
    `chatParentCreate` gets this right by wrapping an owner-identity check.)
  - **Field-whitelisted create.** Port REPORT-73's `chatMessageCreate` shape — a `keys().hasOnly([...])`
    create. The message whitelist **must include `uid`** (the owner field `userIsRequestUser()` pins, ER-9)
    alongside `kind`, `createdAt`, and the content/context payload. **Two distinct checks do two distinct jobs —
    both are required:** (1) an explicit **value**
    assertion — **`request.resource.data.kind == 'user'` only, for the spike (ER-5)** — is what **blocks a client
    forging `kind:'assistant'`** (`keys().hasOnly` does **not** do this — the whitelist necessarily *includes*
    `'kind'`, so `hasOnly` alone lets `{kind:'assistant', …}` through; only the value check rejects it); and (2)
    `keys().hasOnly([...])` blocks **extra / server-owned** fields (lock/cursor/`conversationId`/status).
    **Drop REPORT-73's `|| kind == 'log'` branch (ER-5):** log-forwarding / live tile telemetry is explicitly out
    of scope for this spike (see Out of Scope), and REPORT-73's trigger fires the paid OpenAI call on **both**
    `user` **and** `log` writes — so allowing `kind:'log'` would open a second, unused client-write path to the
    paid trigger for no functional benefit. Restrict the value check to `kind == 'user'`; add `'log'` back only
    if and when log-forwarding is actually implemented and tested. Also
    port REPORT-73's **`createdAt` guard** (SEC-2): require `'createdAt' in request.resource.data` **and**
    `createdAt is timestamp || is int || is float` — the drain orders by `createdAt`, so a doc that omits it or
    carries a non-orderable type would silently burn a lock cycle with no reply, or wedge conversation ordering
    (`report-service/firestore.rules:172-189`). Note **no existing CLUE *create* rule uses `keys().hasOnly`**
    (existing creates use `hasAll`, which permits extra fields): `match /history` (`firestore.rules:456-461`) is
    the **owner-gated-create** model but is *not* field-whitelisted; `isValidRatingUpdate`
    (`firestore.rules:425-431`) is the **field-whitelist** model but is an *update*. So the chat introduces a
    stricter create than any current in-repo precedent — author it deliberately, don't assume a copy exists.
    Not the comment-create rule (comment content is written server-side via admin SDK).
  See Technical Notes "Firestore / identity".

### Gating & configuration

- **Off by default, gated by a `chatTutor` URL query param.** For the spike, the feature is enabled purely
  by a URL query param named **`chatTutor`** (AP uses `?chat`, but CLUE already has a "chat panel" feature,
  so the param is renamed to avoid collision — see Technical Notes): bare `?chatTutor` / `?chatTutor=true` →
  on; absent / `?chatTutor=false` → off. No persistence (the flag never lingers across loads). No
  `UnitConfiguration` / `AppConfigModel` / `content.json` plumbing — that per-unit config is a production
  concern, deferred. CLUE's existing URL-param handling is reused (add `chatTutor` to `QueryParams` +
  `booleanParams` in `src/utilities/url-params.ts`; its `processBooleanValue` already gives the exact
  bare/`=true`/`=false` semantics). The launcher additionally requires the user to be a **student**.
- **Dev/pilot only.** Deployed with pilot/test data only; a hard spend cap on the OpenAI key is a deploy
  precondition (as in REPORT-73). No real student PII (chat content still reaches OpenAI).

## Technical Notes

- **Primary references.** AP-118 spec: `activity-player/specs/AP-118-chat-sidebar-spike.md`. AP frontend:
  `activity-player/src/components/chat/*`, `activity-player/src/utilities/chat-*.ts`. REPORT-73 backend:
  `report-service/functions/src/chat-tutor.ts`, `report-service/functions/src/chat/*`,
  `report-service/firestore.rules` (chat block).
- **CLUE app header.** `src/clue/components/clue-app-header.tsx` — the `.right` region exists in both the
  student header and `renderNonStudentHeader()`; SCSS in `clue-app-header.scss`. (The **launcher itself is
  students-only**, so it is placed only in the student header's `.right` — the non-student header is named here
  only to locate where `.right` lives.) The component destructures ten
  stores (`clue-app-header.tsx:33`: `appConfig, appMode, appVersion, db, user, groups, investigation, ui,
  unit, problem`) and `useStores()` exposes the full store set (including `persistentUI`), so the launcher
  can reach whatever it needs.
- **Sourcing the current workspace document key (per-conversation keying).** The header is **not** wired for
  this today — it does not destructure `persistentUI`. The center workspace document key is
  `persistentUI.problemWorkspace.primaryDocumentKey` (`persistent-ui.ts:44`, `workspace.ts:23,29-30`) — **not**
  `persistentUI.focusDocument`, which returns the *left/resource* document or a section path
  (`persistent-ui.ts:70-77`). Three constraints: (1) `primaryDocumentKey` is `types.maybe`, so the launcher is
  **hidden while keyless** (no doc open yet — IC-5 gates visibility on a defined key, so there is no keyless
  conversation to handle); (2) **a restored key does not imply loaded content (ER-3)** — `PersistentUI` can
  restore `primaryDocumentKey` before the `DocumentModel` exists, and `DocumentModel.content` is **itself**
  `types.maybe` (`document.ts:69`), so the gate must also require
  `documents.getDocument(primaryDocumentKey)?.content` before enabling RIGHT summarization/send (calling
  `documentSummarizer(undefined, {})` throws — `ai-summarizer.ts:89-94`); and (3) because the header is an
  `observer`, both the key **and** the loaded-content check must be read **during render** for the launcher to
  appear/disappear and the conversation to re-key when the student switches (or closes) documents — reading them
  lazily in the click handler would not react. Add `persistentUI` **and `documents`** to the header's store
  destructure.
- **Disambiguation from CLUE's existing "chat panel".** CLUE already has an unrelated **chat panel**
  (`src/components/chat/chat-panel.tsx`, rendered by `nav-tab-panel.tsx`, toggled via
  `persistentUI.showChatPanel` / `isChatEnabled`) — an AI-commenting feature inside the resources/nav-tab
  panel. This spike's tutor is a **separate** feature: it lives under a new **`src/components/chat-tutor/`**
  directory, is gated by the **`chatTutor`** URL param (not `chat`), and is launched from the app header
  (not the nav-tab panel). Keep the two clearly distinct in naming, directory, and state keys.
- **CLUE functions.** `firebase.json` registers three codebases: `functions-v1` (1st-gen, Node 16 —
  callables only, no triggers/secrets/OpenAI), **`functions-v2`** (2nd-gen, Node 20, actively maintained,
  LangChain/OpenAI, six existing Firestore triggers, modern rules-unit-testing — **the port target**), and
  `authoring-api`. The port lands in **`functions-v2`** and keeps REPORT-73's 1st-gen `onWrite` trigger
  verbatim via `firebase-functions/v1` (`functions-v2` runs `firebase-functions@5.1.1`, which re-exports the
  v1 trigger/`runWith` surface — verified). The `defineSecret("OPENAI_API_KEY")` pattern and OpenAI usage the
  port needs already exist in `functions-v2/src/get-ai-content.ts`; none of them exist in `functions-v1`.
- **Context serialization — two paths.**
  - **LEFT (problem JSON).** Granularity = **whole problem** (IC-1/FE-1). There is **no single
    `DocumentContentModel` for a problem**: `ProblemModel.sections` is `types.array(SectionModel)` (`problem.ts:17`)
    and each `SectionModel.content` is its own `DocumentContentModel` (`section.ts:89`, `types.maybe`). So build
    LEFT by **iterating `problemModel.sections[]`, calling `section.content?.exportAsJson()` per section**
    (null-check the `types.maybe`), and **wrapping each parsed result in a structured payload** —
    `{ sections: [{ type, title, content: JSON.parse(section.content.exportAsJson()) }] }` — **not** a single
    `exportAsJson()` / `exportSectionsAsJson()` call, and **not** raw string concatenation (ER-2).
    `exportAsJson()` returns a JSON **string** (it builds via `StringBuilder`, `document-content.ts:141-231`), so
    concatenating multiple section strings produces **invalid JSON**; `JSON.parse` each section's output into the
    wrapper object (which is then `JSON.stringify`d once for the payload). (A delimited plain-text envelope is an
    acceptable alternative only if stated explicitly as text, not JSON.) (`exportSectionsAsJson()` on one document splits *that* document by its internal section-header rows —
    orthogonal to the Problem→Section curriculum structure meant here; do not use it for LEFT.) Each section's
    content serializes through the same `exportAsJson()` path as a workspace document. It is **sent once** on the
    first message (it never
    accumulates additional copies), but — like all conversation content under `store:true` — it is reprocessed
    and **billed as input tokens on every turn**, so keep it reasonably small (it is not a one-time cost).
  - **RIGHT (workspace markdown).** `documentSummarizer` (named export, `shared/ai-summarizer/ai-summarizer.ts`)
    takes `(content, options)` — call it with the live `document.content` node, as `ai-tile.tsx:62` does
    (`documentSummarizer(document.content, {})`); internally it `JSON.stringify`s then `JSON.parse`s the
    content and normalizes it to `{ rowOrder, rowMap, tileMap, sharedModelMap }` (`ai-summarizer.ts:78-101`),
    producing compact markdown "suitable for feeding to AI models," with a `minimal` option that drops
    structural boilerplate. (Earlier drafts said it takes `getSnapshot(document.content)`; the code takes the
    node/string directly and serializes internally.) It is a pure content→markdown function already run
    server-side in `functions-v2` (`on-document-summarized.ts`, `on-analysis-document-pending.ts`) and
    client-side (`ai-tile.tsx`). To embed drawing SVGs, client-side code uses `documentSummarizerWithDrawings`
    — the **default** export of `shared/ai-summarizer/ai-summarizer-with-drawings.ts`. It needs **no** mounted
    tile, refs, or live DOM (it renders via `ReactDOMServer.renderToStaticMarkup`), and there is already a
    client-side precedent for calling it from a top-level app component: `doc-editor-app.tsx:204`
    (`documentSummarizerWithDrawings(getSnapshot(document.content), {…})`). (An earlier draft said "the three
    existing call sites all use plain `documentSummarizer`" — that is stale; this is a fourth call site, and it
    uses the drawings variant.) The reason it "is not available in Firebase functions" is its **import graph**
    (it statically pulls in the Drawing plugin), not a runtime DOM need — which is exactly the bundling concern
    in the FE-2 note below. A **server**-generated summary (the two `functions-v2` call sites) still omits
    drawings. **FE-2 (bundling) — spike uses plain `documentSummarizer`, no drawings.** The Drawing plugin is
    code-split (`register-tile-types.ts:41`, `import(/* webpackChunkName: "Drawing" */ …)`), but
    `documentSummarizerWithDrawings` **statically** imports the drawing plugin's `drawing-object-manager` +
    `drawing-content` (`ai-summarizer-with-drawings.ts:9-10`) and `react-dom/server`; the header is in the main
    `index` webpack entry (`webpack.config.js:68`), so an eager import from `chat-tutor/` would hoist the Drawing
    chunk + `react-dom/server` into `index`. (The existing `WithDrawings` client precedent lives in the separate
    `doc-editor` entry, `:70`, so it does not show `index` already carries this.) Spike decision: use plain
    `documentSummarizer` (no drawing SVGs); a later tier can `import()` the drawings variant dynamically at
    send-time to keep it code-split. **Cost note (ER-7):** each call is a full stringify+parse+normalize of the
    whole document, so do **not** drive it from a per-change observer — in CLUE a keystroke *is* a content
    mutation, so an observer on `document.content` fires per character. Use a **dirty flag** (a cheap
    `onPatch`/reaction that only flips a boolean) and recompute the summary **lazily on send, only if dirty**
    (sends are user-initiated/infrequent), then hash-compare to gate the actual re-send. Avoid phrasing this as
    "on document change vs. keystroke" — those are the same event in CLUE.
    This markdown is far more compact than raw `exportAsJson` (which embeds full `SharedDataSet` rows and
    drawing-object arrays unbounded — `document-content.ts:151-166`, `drawing-content.ts:132-151`), which is
    why RIGHT uses it and hashes it for send-on-change.
  - **Why LEFT stays JSON, not markdown.** The curriculum markdown path (`summarizeCurriculum` /
    `summarize-curriculum-doc.ts`) is documented in its own source as low-quality (tiles not header-labeled,
    rows flattened, authoring export format differs for question/table/text tiles — `ai-summarizer.ts:32-48`).
    Since LEFT is authored reference content sent once, full-fidelity JSON is the better trade.
  - **Answer-key note.** LEFT is **authored curriculum** (reference content), not the student's own work, so
    the context builder must draw LEFT from student-visible problem content only and must not serialize any
    teacher-facing document (the Teacher Guide is a separate `ProblemModel` on the same `exportAsJson` path);
    the students-only launcher gate already prevents teacher-guide exposure in the spike.
- **Firestore / identity.** The tutor chat lives in its **own new collection(s)** with its **own fresh
  rules** — it does not reuse or extend the comment rules. What carries over from existing CLUE rules:
  - **Identity idiom.** Author the new rules using CLUE's existing helpers/claim names
    (`request.auth.token.platform_user_id` / `user_type` / `class_hash`, `isAuthed()`, `userIsRequestUser()`,
    `userIsResourceUser()`, `hasRole()`), so they authorize by CLUE's portal-JWT model and stay
    consistent/reviewable. **Student role claim (ER-6):** the real Firebase token students carry has
    `user_type: "learner"` (`portal-types.ts:104`), so define the chat helper as
    `isStudentClaim()` → `hasRole("learner")` (**not** `"student"`, which is only the client-side app-model
    remap, `user.ts:162`). **Owner comparisons (ER-6):** always `string(...)`-cast the numeric
    `platform_user_id` claim (as every existing owner check does, `firestore.rules:58,68`) — reuse
    `userIsRequestUser()` / `userIsResourceUser()`, which compare `string(request.auth.token.platform_user_id)`
    against a string `uid` field, rather than writing a raw `==`. (Note: inline `teachers[]`
    on document records is a **deprecated** pattern per `firestore.rules:393-396` — key on `context_id`→class,
    don't put `teachers[]` on a chat doc.)
  - **Path / keying (top-level, self-contained — SEC-3).** The chat is a **top-level** collection under
    `/authed/{portal}/…` (its own root), **not** a subcollection of `documents/{docId}` — so the whole spike's
    data can be deleted by dropping one collection when the spike ends. The **canonical conversation doc id** is
    **`networkDocumentKey(uid, documentKey, network) + "_" + escapeKey(problemPath)`** — CLUE's document identity
    (`networkDocumentKey`, `shared/shared.ts:114-119`) joined with the current problem (ER-1), **with
    `problemPath` `escapeKey()`-ed first (ER-8).** `escapeKey` (`shared/shared.ts:1-3`) replaces `/.$[]#` with
    `_`, and `problemPath` is slash-delimited (`buildProblemPath` → `unitCode/inv/prob`, `shared/shared.ts:55-56`);
    `networkDocumentKey` escapes only the doc key/network, **not** an appended `problemPath` — so combining the
    **raw** `problemPath` would inject `/` path separators, splitting the single conversation doc into a nested
    path and breaking the "delete one top-level collection" cleanup. `escapeKey(problemPath)` keeps it a single,
    still-human-inspectable id. Carry the owner as a **`uid`** field (the **string** form of `platform_user_id`,
    matching CLUE convention — ER-6) + `context_id` **+ the raw (unescaped) `problemPath`** as **fields on the
    doc** (the rules authorize against those fields, since the `documents`-scoped helpers are out of scope for a
    top-level collection; the raw `problemPath` field stays queryable even though the id uses the escaped form).
    **Why `problemPath` is part of the key (ER-1):** `networkDocumentKey` alone identifies a
    document, and CLUE reuses some workspace documents (personal documents, learning logs) across problems, so a
    document-only conversation key would persist one transcript that outlives the problem whose LEFT it installed
    once — the tutor would keep reasoning against a stale problem. `problemPath` (a monotonic, human-readable
    `unitCode/investigation/problem` path — `buildProblemPath`, `unit.ts:161`; exposed at `stores.problemPath`)
    scopes the conversation to a single problem so LEFT is genuinely static for its lifetime. (Problem-bound
    documents key to exactly one `problemPath` anyway, so this only changes behavior for the reusable doc types.) Because it
    is top-level, the owner/teacher/researcher checks are **re-implemented locally** (see Read rule), not
    inherited from `match /documents`. This is a keying reference only — **not** the comments-subcollection
    shape, and **not** AP's `/sources/{source}/chats/...`.
  - **Client-create template (corrected).** The spike's client writes `user`-message docs **directly**
    (subject to rules). Two distinct in-repo models, neither of which is a single ready-made match: use
    `isValidRatingUpdate` (`firestore.rules:425-431`) as the **field-whitelist** model (it uses
    `keys()...hasOnly` / `affectedKeys().hasOnly`) and `match /history` (`firestore.rules:456-461`) as the
    **owner-gated-create** model (`isAuthed() && userOwnsDocument()`) — but note `match /history` writes
    **arbitrary fields** (no key whitelist), and **no existing CLUE create rule uses `keys().hasOnly`** (they
    use `hasAll`). So the chat's field-whitelisted create is a *stricter* pattern than any current create
    precedent; port REPORT-73's `chatMessageCreate` shape rather than expecting a copy. That shape carries
    **four** load-bearing checks the prose above must not blur together: (a) `keys().hasOnly([...])` — blocks
    **extra / server-owned** fields; (b) an explicit **value** check — **`kind == 'user'` only for the spike
    (ER-5)**, dropping REPORT-73's `|| kind == 'log'` since log-forwarding is out of scope and `log` writes also
    fire the paid trigger — this (not `hasOnly`) is what blocks a forged `kind:'assistant'`, since the `hasOnly`
    whitelist includes `'kind'` and so permits any `kind` *value*; (c) a `createdAt` presence + orderable-type
    guard (`'createdAt' in data && (createdAt is timestamp || is int || is float)`) so a missing/non-orderable
    `createdAt` can't wedge the drain's ordering (`report-service/firestore.rules:172-189`); and (d) an
    **`isStudentClaim()` gate (= `hasRole("learner")`, ER-4 + ER-6)** plus the owner pin via the global helper
    **`userIsRequestUser()`** (which asserts `string(request.auth.token.platform_user_id) ==
    request.resource.data.uid` — the `string()` cast and `uid` field per ER-6), so only the student owner can
    create — otherwise a teacher/researcher could write a `kind:'user'` doc directly and fire the paid trigger,
    since the rules layer (not the hidden launcher) is the real students-only boundary. **Use `"learner"`, not
    `"student"`** — that is the real Firebase claim (`portal-types.ts:104`); the `"student"` value exists only in
    the client-side app-model remap and in the (latently-wrong, never-role-checked) `firebase-test` `studentAuth`
    fixture (ER-6).
    NOT the comment-create rule: comment *content* is written server-side via a Cloud Function (admin SDK,
    bypassing rules — `functions-v2/src/post-document-comment.ts:43-44`), so its create rule is not the
    client-write pattern the chat needs.
  - **Read rule (owner-only + student-only).** Because the chat is top-level (SEC-3), the
    transcript **read** rule reuses the **global** helper — `userIsResourceUser() && isStudentClaim()` — where
    `userIsResourceUser()` asserts `string(request.auth.token.platform_user_id) == resource.data.uid`
    (`firestore.rules:68-72`; the `string()` cast handles the numeric claim, ER-6) and `isStudentClaim()` =
    `hasRole("learner")` (ER-6). This is **not** the `documents`-scoped `userOwnsDocument()` helper (out of scope)
    and **not** the `documents` read rule, whose `resourceInUserClass()` branch (`firestore.rules:352,177-179`)
    would expose a student's transcript to every classmate. The `isStudentClaim()` gate makes the students-only
    decision rules-enforced, not UI-only (ER-4); using `"learner"` (not `"student"`) is what makes it actually
    match real students (ER-6). Owner-only + student-only read is a rules acceptance criterion. **No
    teacher/researcher read branch** (SEC-5) — students-only / no-observer-UI; evaluators inspect via the
    Firestore console/emulator.
  - **Rate/abuse (rules can't help).** Firestore rules cannot throttle writes, and there is no per-user quota
    anywhere in `functions-v2/src`. Since a client `user`-doc write fires the paid OpenAI trigger, one student
    scripting rapid sends can exhaust the **shared** spend cap for everyone (budget-exhaustion), and — because
    REPORT-73's trigger is `onWrite` (create **and** update) — a re-saved message doc could re-fire (the
    per-conversation lock + self-trigger guard bound concurrency and self-writes, not total user-initiated
    volume). The ER-4/ER-6 `isStudentClaim()` (`hasRole("learner")`) create gate **narrows the population** that
    can fire the trigger to students-only (a teacher/researcher can no longer write chat docs directly), but does
    **not** throttle an individual student. Real mitigations (deferred, but named): create-only trigger semantics + a lightweight
    per-user/per-minute quota. See Risks.
- **Client function plumbing.** `src/hooks/use-firebase-function.ts` (typed callables + warm-up). Note the
  ported backend is a Firestore **trigger**, not a callable — the client writes docs directly and
  subscribes, so the callable plumbing is not the transport (it may still be useful for a warm-up ping).
- **Testing approach (seams reused from REPORT-73/AP).** The `DebugTransport` seam renders "what would be
  sent" with no backend, so the entire sidebar UI + accessibility bar is testable before any function
  exists. The `onWrite` trigger, the lock/drain, and the Firestore security rules are tested against the
  **Firestore emulator** (as REPORT-73 did) — requires **Java** (see CLAUDE.md). **Which harness (SEC-6):** the
  **auth-context rules** validation the deploy-target question calls primary (minted custom tokens carrying
  `platform_user_id`/`user_type`/`class_hash`) belongs in the **`firebase-test/` suite** — it is on **Node 16** +
  `@firebase/rules-unit-testing@^1.3.16` and already mints `studentAuth`/`teacherAuth`/`researcherAuth` contexts
  (`firebase-test/setup-rules-tests.ts:14-43`), the ideal landing spot for the new chat-rules tests. **Learner
  claim in the new tests (ER-6) — new code only:** the existing shared `studentAuth` fixture is
  `user_type: "student"`, which is **wrong** vs. the real portal Firebase token (`"learner"`,
  `portal-types.ts:104`) and has gone unnoticed only because no existing rule branches on the student role
  (`firestore.rules:32` `hasRole` is only ever called with `"teacher"`/`"researcher"`). The new chat rules check
  `hasRole("learner")`, so the **new chat-rules tests must use a `user_type: "learner"` auth context** (define a
  fresh fixture in the new test file — e.g. `studentLearnerAuth = { …, user_type: "learner", platform_user_id:
  <numeric> }` — **do not** reuse or edit the shared `studentAuth`; reusing its `"student"` value would make the
  emulator test pass while production denies every student, masking the bug). No change to existing fixtures or
  existing tests. **Not** `functions-v2`'s "modern `@firebase/rules-unit-testing@^4`" harness: its emulator tests
  drive Firestore via the **admin SDK** (`firebase-functions-test` + `admin.firestore()`), which **bypasses
  rules** — so it exercises trigger/logic, not auth-context rules. The send-context-only-on-change checksum logic warrants a unit test
  (first message always sends). No separate formal DoD checklist for the spike; the Requirements above
  enumerate the behaviors.
- **Later-tier upgrades (designed for, not built):** tool-calling so the LLM pulls left/right JSON on
  demand (token savings; the payload already lives on the message, so this is a pure backend change);
  swap the LLM core to LangChain / Claude (`ChatOpenAI` ↔ `ChatAnthropic`); log-forwarding of CLUE
  tile-edit events (CLUE's equivalent of AP Phase 2); streaming via a 2nd-gen function.

## Risks & Accepted Spike Risks

- **PII in student work sent to OpenAI (headline risk).** The tutor's context includes the student's
  free-form **workspace document**, which can contain names and other PII, plus the student's typed chat —
  all sent to OpenAI. This is the single biggest risk of the feature. Bounds for the spike: **pilot/test
  data only, no real-student PII**; any real-student pilot is gated on a **consent/IRB + retention
  decision** (a persisted per-document transcript of student work + chat is research data). **Spike
  default: test accounts only** — real-student piloting is out of scope pending the FERPA/PII + retention
  review.
- **Firestore rules are security-critical and net-new.** The field-whitelisted create rules that keep
  server-owned lock/cursor/conversation fields un-writable and prevent a client forging a
  `kind:'assistant'` reply must be **re-derived against CLUE's identity model** (not copied). A mistake is
  a real exposure; treat the rules as a carefully-reviewed deliverable with its own acceptance check. **The
  rules only take effect in `appMode=authed`** — validate them via Firestore-emulator tests with minted
  custom tokens (and a real portal launch), **not** via `?appMode=qa` (anonymous → permissive subtree). See
  the resolved "Which Firebase project / deploy target" question. Acceptance criteria worth calling out
  explicitly: **owner-only + student-only transcript reads** (do not copy the `documents` rule's class-wide
  `resourceInUserClass()` branch — it would leak transcripts to classmates); a **`keys().hasOnly` create
  whitelist** (a stricter pattern than any existing CLUE create rule; see Technical Notes "Firestore /
  identity"); an **`isStudentClaim()` = `hasRole("learner")` gate on create *and* read** (the real Firebase
  claim is `"learner"`, **not** `"student"` — ER-6) so students-only is rules-enforced, not UI-only — otherwise a
  teacher/researcher could write a chat doc directly and fire the paid trigger (ER-4); **owner checks via the
  global `userIsRequestUser()`/`userIsResourceUser()` helpers** (`string(...)`-cast `platform_user_id` against a
  `uid` field — ER-6, do not use a raw `==`); and a **`kind == 'user'`-only value check** (no `kind:'log'` —
  log-forwarding is out of scope; ER-5).
- **Spend / abuse — bounded, but not per-student.** A **hard spend cap on the OpenAI key is a deploy
  precondition.** Unlike AP (which accepted unauthenticated anonymous runs firing paid triggers), CLUE
  students are **authenticated** (portal JWT), so AP's anonymous-abuse and anonymous-cross-read risks do not
  apply. But the cap bounds *total* spend, **not per-student fairness**: since a client `user`-doc write
  fires the paid trigger and Firestore rules cannot throttle, one student scripting rapid sends can exhaust
  the shared budget for everyone (budget-exhaustion), and an `onWrite` (create+update) trigger could re-fire
  on a re-saved message. The real mitigations — **create-only trigger semantics + a lightweight
  per-user/per-minute quota** — are named but out of scope for the spike; production-grade rate limiting is
  deferred.
- **FERPA/PII + retention review** is deferred to a production effort; the spike does not ship to real
  students without it.

## Out of Scope

- **AP's server-side activity fetch / LARA convert / URL-keyed sim prompts** — deleted; CLUE has no
  fetchable resource and its "sims" are tiles.
- **Tool-calling / on-demand context retrieval** — deferred (payload-on-message keeps it a later backend
  change).
- **Log-forwarding / live tile-edit telemetry** (CLUE's AP-Phase-2 equivalent) — deferred; context (LEFT JSON
  / RIGHT markdown) rides on `user` messages only.
- **Streaming** — the `onWrite` trigger writes a complete message.
- **Placing the button in the existing comments/Discussions UI** — explicitly superseded by the app-header
  launcher.
- **Teacher/researcher observer UI for tutor transcripts** — none. The launcher is students-only (Resolved
  Q1), and transcripts (persisted per Resolved Q3) are reviewed by evaluators via **Firestore/emulator
  inspection only** for the spike. In-product teacher preview/observation is deferred (consistent with
  "a role list can be added later" in Resolved Q1).
- **Production hardening** — real rate limiting/abuse controls beyond a hard OpenAI spend cap, quotas, and
  a formal FERPA/PII + retention review.
- **Mobile / narrow-viewport layout** — desktop/laptop assumed (as in AP).

## Open Questions

### RESOLVED: Which users can open the tutor?
**Context**: AP restricted live chat to authenticated **learners** and real anonymous runs (teachers/
researchers excluded). CLUE has students, teachers, and researchers, and its comment feature already gates
by role via `enableCommentRoles`. The tutor coaches a student on their own work.
**Options considered**:
- A) **Students only** (matches AP's learner-only model; the tutor is for the person doing the work).
- B) Students + teachers (teachers could preview/observe the tutor).
- C) Reuse an `enableCommentRoles`-style per-unit role list.

**Decision**: **A — students only.** Matches the ported learner-only model and keeps identity/rules
simple for the spike. The header launcher is shown only to users whose role is student; the Firestore
rules scope chat writes/reads to the student owner. A role list can be added later if a pilot wants
teacher preview.

### RESOLVED: What counts as "the left panel" context document?
**Context**: The right panel is unambiguous (the student's workspace document). The left "Lessons and
Documents" panel can show the current **problem/curriculum section**, another student's document, class
work, etc. The tutor's "resource" context needs a defined source.
**Options considered**:
- A) The **current problem** (the authored curriculum the student is working in — closest analog to AP's
  authored page). Sub-choice: the *whole problem* vs a single *current section*.
- B) Whatever document is **currently displayed in the left resource panel** (could be non-curriculum).
- C) Both when available (problem always + left-panel doc if different).

**Decision**: **A — the current problem, at WHOLE-PROBLEM granularity** (updated per IC-1/FE-1, 2026-07-08).
The cleanest, most stable analog to AP's authored page ("what the student is supposed to be reasoning about"),
avoiding B's messy cases (another student's doc, empty panel). **Whole problem, not a single section:** LEFT is
installed once, so a single "current section" would only capture wherever the student happened to be at the
first message; the whole problem is unambiguously static for the conversation. Mechanically there is no single
`DocumentContentModel` for a problem, so LEFT is built by iterating `problemModel.sections[]`,
`exportAsJson()`-ing each section's content, and assembling a **structured** `{ sections: [...] }` wrapper
(parsing each section's JSON string — not concatenating strings, which is invalid JSON; ER-2). See Requirements
+ Technical Notes. The student's own work is
already covered by the right-panel workspace document, so resource-context = the current problem and
work-context = the workspace document.

### RESOLVED: Conversation persistence / history retention
**Context**: AP conversations persist in Firestore keyed by run/learner. In CLUE, a per-document
conversation could persist across sessions (student returns to the doc) or be ephemeral.
**Options considered**:
- A) Persist per document indefinitely (reload rehydrates; matches AP).
- B) Ephemeral per session.

**Decision**: **A — persist per document indefinitely.** How the ported code already behaves (Firestore
is the source of truth; reload rehydrates via `onSnapshot`), so it is less work than adding teardown, and
better for a pilot (inspectable transcripts, student continuity). The dev/pilot-data-only + deferred
formal retention review caveat applies regardless. **(Refined by ER-1:** the persisted conversation is keyed
per document **and `problemPath`** — so a workspace document reused across problems, e.g. a personal document
or learning log, gets a distinct persisted conversation per problem rather than one that outlives any single
problem's installed-once LEFT.**)**

### RESOLVED: Feature gate mechanism
**Context**: Need a way to turn the tutor on. Options ranged from a per-unit `UnitConfiguration` boolean
to a simple URL param.
**Options considered**:
- A) `UnitConfiguration` boolean (`enableChatTutor`) surfaced through `AppConfigModel`, set in
  `content.json` — the production-shaped approach.
- B) A **`chatTutor` URL query param** (like AP's `?chat`, renamed), no config plumbing.

**Decision**: **B — a `chatTutor` URL query param.** Since this is a spike to test the feature, gate it
purely by `?chatTutor` (AP's `resolveChatEnabled()` uses `?chat`, renamed here to avoid colliding with
CLUE's existing "chat panel"), with no persistence and no unit-config plumbing. Per-unit
`UnitConfiguration` gating is a production concern, deferred to a later tier.

### RESOLVED: Which functions codebase hosts the backend?
**Context**: `firebase.json` registers `functions-v1` (1st-gen, Node 16), `functions-v2` (2nd-gen, Node 20),
and `authoring-api`. REPORT-73's trigger is a 1st-gen `onWrite`, which initially suggested landing it in
`functions-v1`. But verification showed `functions-v1` has **no Firestore triggers, no `defineSecret`, and
no OpenAI usage** and runs on EOL Node 16 + `firebase-functions@3.24.1`, while `functions-v2` already has
six Firestore triggers, the `defineSecret("OPENAI_API_KEY")` + OpenAI patterns the port needs, Node 20, and
modern `@firebase/rules-unit-testing@^4`.
**Options considered**:
- A) `functions-v1` — matches REPORT-73's 1st-gen home for a verbatim copy, but inherits Node 16 and net-new
  trigger/secret/OpenAI wiring with no in-codebase precedent.
- B) **`functions-v2`, hosting the 1st-gen trigger via `firebase-functions/v1`** — keeps REPORT-73's trigger
  code nearly verbatim while inheriting Node 20, the existing secret/OpenAI patterns, and modern test tooling.

**Decision**: **B — `functions-v2`, 1st-gen trigger via `firebase-functions/v1`.** Empirically verified in
this repo (`functions-v2` @ `firebase-functions@5.1.1`): `require('firebase-functions/v1')` resolves and
exposes `v1.firestore.document(path).onWrite`, `v1.runWith({secrets})`, and `defineSecret("OPENAI_API_KEY")`
— so REPORT-73's `chatTutorOnWrite` ports nearly verbatim into `functions-v2` with none of the `functions-v1`
tax. Every capability the port needs (Firestore triggers, server-side secret, OpenAI) already exists in
`functions-v2`; none exist in `functions-v1`.

### RESOLVED: Which Firebase project / deploy target for the spike?
**Context**: REPORT-73 deployed only to `report-service-dev`. CLUE has its own Firebase project(s)
(dev/qa/production partitions). The spike needs a dev target with a spend-capped OpenAI key.
**Options considered**:
- A) A CLUE dev/qa Firebase project + partition.
- B) A dedicated throwaway project.

**Decision**: **A — a CLUE dev/qa Firebase project + partition.** The port needs CLUE's real Firestore
structure, security rules, and portal-auth identity model to be meaningful, so a CLUE dev/qa project
exercises the true rules/identity path (a throwaway project lacks CLUE's portal-auth setup). A hard
spend cap on the OpenAI key bounds the risk. (Specific project/partition TBD at deploy time.)

**Important — how the security rules are actually validated (a dev/qa *project* is not a dev/qa *appMode*):**
The field-whitelisted `/authed/**` chat rules can only be exercised when the portal JWT claims
(`platform_user_id`/`user_type`/`class_hash`) are present, which happens **only in `appMode=authed`**
(`src/lib/db.ts:173-176`, `signInWithCustomToken`). The unsecured `?appMode=dev|qa|test` shortcuts sign in
**anonymously** (`db.ts:181-183`) and route to the permissive `/dev|/qa|/test` subtrees where the
field-whitelist rules are **never evaluated** (`firestore.rules:486-506`). So the rules deliverable is
validated by: **(primary) Firestore-emulator tests with minted custom tokens** carrying the claims
(deterministic, in-CI — see the Testing note), and **(secondary) a real portal launch (`appMode=authed`)**
for manual end-to-end confirmation — **not** by opening the spike with `?appMode=qa`.

## Self-Review

### Senior Engineer

#### RESOLVED: "Send context only when changed" leaves stale document snapshots in the conversation
With the OpenAI Conversations API, a fresh context message sent on a later turn does not remove the
earlier one — every context snapshot the client ever sent stays in the conversation history. The model
can then reason over an **outdated** version of the student's document. The requirements say context
refreshes when changed but don't say the latest snapshot is authoritative. Resolution: state that each
context payload must be marked/framed so the model treats the **most recent** one as the current
document state (e.g. a "this supersedes any earlier document snapshot" framing, or a timestamp/sequence
in the envelope), and note this as a design constraint for implementation.

**Decision**: **Agreed.** Added the requirement below (Requirements → Backend) that context payloads must
be framed as authoritative-latest. See "Latest-context-wins framing."

#### RESOLVED: "Reuse `drain.ts`/`openai.ts` largely verbatim" overstates the reuse
`drain.ts`'s prompt-composition path (`composePageSystemPrompt`) depends on exactly the modules we are
deleting (`fetch-activity.ts`, `convert.ts`, `page-walk.ts`, `chat-context.ts`, `sim-prompts.ts`). The
lock/drain/cursor **mechanics** port nearly verbatim, but the **context-composition** half of `drain.ts`
is substantially rewritten to read the client-supplied JSON off the message instead of fetching/assembling
an activity page. Resolution: reword the backend requirement to scope "verbatim reuse" to the
lock/drain/trigger machinery, and mark context assembly as new CLUE-specific code.

**Decision**: **Agreed.** Split the backend requirement into "machinery reused nearly verbatim" vs.
"context assembly is new CLUE-specific code."

#### RESOLVED: Feasibility — is the left problem/curriculum section serializable like a document?
The context design assumes `exportAsJson()` works for **both** panels, but that method lives on
`DocumentContentModel` (the student's workspace). CLUE curriculum/problem content may not be the same
model instance and may need a different serialization path (or may already be a document — needs
confirming).

**Decision**: **Verified — same path works.** `SectionModel.content` is a `DocumentContentModel`
(`src/models/curriculum/section.ts:89`; investigations/units likewise hold `DocumentContentModel`), so
the left problem/section content serializes through the **same `exportAsJson()`** path as the workspace
document — no separate serialization code. Residual nuance (implementation-level, not a feasibility risk):
a Problem has multiple Sections, so "current section vs. whole problem" for the left context is an
implementation choice. Technical note updated accordingly.

### Security Engineer

#### RESOLVED: PII in student work sent to OpenAI is the headline risk, under-weighted
The workspace document is free-form student work that can contain names and other PII, and it is sent to
OpenAI. The spec mentions "no real student PII" once, but this is the single biggest risk of the feature
and deserves a first-class callout: pilot/test data only, no real-student PII, and any real-student pilot
gated on a consent/IRB + retention decision. Resolution: elevate this to a prominent risk statement (and
cross-reference the Education Researcher finding).

**Decision**: **Agreed.** Added a dedicated "Risks & Accepted Spike Risks" section leading with the
PII-to-OpenAI risk; folded in the rules-criticality and spend/abuse notes there too.

#### RESOLVED: Re-expressing the field-whitelisted Firestore rules against CLUE's identity model is a first-class task, not a copy
REPORT-73's security depends on field-whitelisted create rules (owner fields only on the parent;
`kind:'user'` + whitelisted payload on messages; server-owned lock/cursor/conversation fields admin-only).
These must be **fully re-derived** against CLUE's portal-JWT/class-offering-user model and CLUE's existing
comments/documents rules — a mistake lets a client write server-owned lock fields or forge a
`kind:'assistant'` reply. Resolution: call this out as a required, carefully-reviewed deliverable with its
own acceptance check, not "modeled on."

**Decision**: **Agreed.** Captured in the "Risks & Accepted Spike Risks" section (rules are
security-critical + net-new); acceptance check to be enumerated in the QA DoD (Finding 8).

#### RESOLVED: Abuse/spend risk profile is *better* than AP's (informational)
AP accepted unauthenticated anonymous chat docs firing paid triggers. CLUE students are **authenticated**
(portal JWT), so the anonymous-abuse and anonymous-cross-read risks AP accepted do not apply here — the
spend risk reduces to authenticated students over-using the tutor, bounded by the hard OpenAI spend cap.
Noted as a favorable difference; no change required beyond keeping the spend cap as a deploy precondition.

### Product Manager

#### RESOLVED (no change): No explicit spike success criteria or target pilot scenario
The spec says the goal is "to learn whether a contextual, document-aware tutor is useful" but doesn't
define what would count as success, or the concrete pilot scenario. The Jira names a specific case (the
"vibe" unit where students design/debug control-and-feedback programs and are encouraged to plan and
describe their program). Resolution: add a short **Spike Goals / Definition of Done** section stating the
evaluation question(s), the target pilot unit/scenario, and what a "useful" result looks like.

**Decision**: **Not needed — dismissed by project owner.** A formal spike-goals/DoD section is not wanted
for this spike; the existing Overview framing is sufficient.

### Student

#### RESOLVED: Empty state and the "won't give answers" expectation need to be set in the UI
A student opening the tutor needs to know what it's for and that it coaches rather than answering. AP's
empty state ("Ask the tutor about this page") assumed the page framing; CLUE's should orient the student
to *their work* and gently set the no-direct-answers expectation to avoid frustration. Resolution: add a
requirement for a CLUE-appropriate empty-state/orientation line.

**Decision**: **Agreed (light touch).** Added a frontend requirement to reword the empty-state copy for
CLUE's document framing; expectation-setting otherwise left to the tutor's replies. No onboarding UI.

### Education Researcher

#### RESOLVED: Clarify the pilot population (test accounts vs. real students) and transcript handling
"Dev/pilot only, no real student PII" and "persist per document indefinitely" are in mild tension: if a
real-student pilot is intended, persisted transcripts of student work + chat become research data with
consent/retention obligations. Resolution: state explicitly whether the pilot uses **test accounts** or
**real students**, and if real, that transcript retention/consent is gated on a research decision (ties to
the Security PII finding).

**Decision**: **Agreed.** Pinned the spike default to **test accounts only** in the Risks section;
real-student piloting out of scope pending the FERPA/PII + retention review.

### WCAG Accessibility Expert

#### RESOLVED: Restyle must preserve contrast, and launcher/drawer focus must integrate with CLUE's keyboard nav
Porting AP's accessibility bar is necessary but not sufficient: (1) restyling to CLUE's palette can
regress color contrast (WCAG AA) on the launcher, composer, and bubbles — the restyle must be
contrast-checked, not just color-matched; (2) the header launcher and the drawer's focus management must
integrate with CLUE's existing header and keyboard navigation (there is active CLUE keyboard-nav work),
rather than assume AP's DOM. Resolution: add these as explicit accessibility requirements.

**Decision**: **Agreed.** Added two accessibility requirements: WCAG AA contrast checked on the restyle,
and launcher/drawer focus integrated with CLUE's header tab order / keyboard navigation.

### QA Engineer

#### RESOLVED: No acceptance-criteria / DoD checklist, and the rules/trigger test seam isn't stated
The spike needs an enumerated, testable DoD (launcher gating by `?chat` + student role; send→reply
round-trip via Firestore; per-conversation lock serialization; send-context-only-on-change; reload
rehydration; the accessibility bar) and a stated test approach: `DebugTransport` for the backend-free UI,
and the Firestore emulator for rules + trigger (as REPORT-73 did; note CLUE's rules-test tooling needs
Node 16 + Java). Resolution: add a DoD/acceptance list and a testing note.

**Decision**: **Agreed in part.** Added a "Testing approach" technical note (DebugTransport for UI;
emulator for rules+trigger; Node 16 + Java; checksum unit test). No separate formal DoD checklist — the
Requirements already enumerate the behaviors (consistent with dismissing the PM DoD section).

---

## Self-Review — Pass 2 (code-verified, 2026-07-07)

Every finding below was checked against the actual CLUE codebase and the two source repos
(`activity-player` @ `AP-118-add-chat-sidebar`, `report-service` @ `REPORT-73-chat-tutor-backend`)
before being written. Evidence cited inline as `file:line`.

### Senior Engineer / Firebase Cloud-Functions Engineer

#### RESOLVED: Port target `functions-v1` is asserted without rationale, and it lacks every capability the spike needs
The spec fixes the backend port target as **`functions-v1`** (Technical Notes; Backend requirements) but
there is no OPEN/RESOLVED question justifying it over **`functions-v2`**. Verified against the codebase,
the choice runs against every existing precedent:
- **`functions-v1` has zero Firestore triggers today** — it exports only four `functions.https.onCall`
  callables (`functions-v1/src/index.ts`). The `onWrite` trigger the spike ports would be net-new to v1's
  pattern.
- **`functions-v1` has zero secret usage** — no `defineSecret` / `firebase-functions/params` anywhere;
  the `defineSecret("OPENAI_API_KEY")` pattern the spec cites as a reference lives in **`functions-v2`**
  (`functions-v2/src/get-ai-content.ts:5,17`).
- **`functions-v1` has zero OpenAI usage** — CLUE's only OpenAI integration is in `functions-v2`.
- **`functions-v1` is on EOL Node 16 + `firebase-functions@3.24.1`** (`functions-v1/package.json`),
  vs `functions-v2` on Node 20 + `firebase-functions@^5.1.1` with **six existing Firestore triggers**
  (`on-user-doc-written`, `on-class-data-doc-written`, etc.) and modern `@firebase/rules-unit-testing@^4`.
- The only thing pulling toward v1 is "REPORT-73's trigger is 1st-gen, so a 1st-gen home is a verbatim
  copy." But `firebase-functions@5` (in v2) still exports `firebase-functions/v1`, so a v1-style
  `onWrite` trigger can be hosted **inside `functions-v2`** nearly verbatim while inheriting Node 20, the
  existing `defineSecret`/OpenAI patterns, and the modern test tooling.

Suggested resolution: add a RESOLVED question that either (a) moves the port to `functions-v2` (hosting
the 1st-gen trigger via `firebase-functions/v1` if verbatim fidelity matters), or (b) explicitly justifies
staying in `functions-v1` and accepts Node 16 + net-new secret/OpenAI wiring there.

**Decision**: **Agreed — option (a).** Empirically verified `firebase-functions/v1` resolves in
`functions-v2` (`firebase-functions@5.1.1`) and exposes `v1.firestore.document(path).onWrite`,
`v1.runWith({secrets})`, and `defineSecret`. Added RESOLVED question "Which functions codebase hosts the
backend?" (→ `functions-v2`, 1st-gen trigger via `firebase-functions/v1`); updated the Backend requirements
heading + trigger/secret bullets and the Technical Notes CLUE-functions line to target `functions-v2`.

#### RESOLVED: The OpenAI "Responses + Conversations API + strict json_schema" approach has no precedent in CLUE and diverges from CLUE's existing LLM integration
Verified: CLUE's only LLM code (`functions-v2/src/get-ai-content.ts`, `on-class-data-doc-written.ts`)
uses **LangChain `ChatOpenAI`** against **chat.completions** (`gpt-4o-mini`), with **no** structured-output
enforcement, **no** `response_format`/`json_schema`, and **no** Conversations API. The raw `openai` SDK is
a dependency but unused. REPORT-73's ported `openai.ts` (verified genuinely clean and verbatim-portable)
uses `openai.responses.create` + `openai.conversations.*` + strict `json_schema`. So the port introduces
a wholly new OpenAI surface with no in-repo reference and diverging from the LangChain approach CLUE uses
elsewhere. This is fine for a spike but should be called out as net-new (not "reuse an existing pattern"),
and the maintainability trade-off (two different OpenAI integration styles in one repo) noted. Ties to the
port-target finding above.

**Decision**: **Resolved as-is (no further change).** Low-severity accuracy point; porting REPORT-73's
`openai.ts` verbatim is the plan and a virtue (less rewriting). The net-new/divergent nature is now labeled
at the point it matters — the OpenAI requirement bullet notes the raw-`openai`-SDK Responses/Conversations
surface is net-new to CLUE and differs from the existing LangChain `ChatOpenAI` (chat.completions)
integration. Forcing the tutor onto LangChain would add work and lose the verbatim port, so no approach
change.

#### RESOLVED: Naming/feature collision — CLUE already has a "chat panel"
Verified: CLUE already ships a right-side **chat panel** (`src/components/chat/chat-panel.tsx`, rendered by
`nav-tab-panel.tsx`), toggled via `persistentUI.showChatPanel` / `isChatEnabled`, living inside the
resources/nav-tab panel. It is an existing AI-commenting feature. This spike adds a **different** AI chat
tutor, a new **`?chat`** URL param, and ports AP components that also live under `src/components/chat/*`.
Risks: (1) a literal path collision if AP's files are dropped into `src/components/chat/`; (2) concept
confusion between the existing "chat panel" and the new "chat tutor"; (3) `?chat` param vs the existing
`showChatPanel`/`isChatEnabled` state. Suggested resolution: name the new feature distinctly (e.g.
`chat-tutor` directory + `?chatTutor` or a clearly-scoped param), and add a Technical Note disambiguating
it from the existing chat panel.

**Decision**: **Agreed — option (a).** New feature lives under `src/components/chat-tutor/` and is gated by
the **`chatTutor`** URL param (not `chat`). Updated the launcher + sidebar-overlay requirements, the Gating
section, and the "Feature gate mechanism" resolved question; added a "Disambiguation from CLUE's existing
chat panel" Technical Note. This also folds in the factual-corrections note that the header exposes ten
stores (incl. `persistentUI`), not seven.

### Firebase / Performance Engineer

#### RESOLVED: Context snapshots accumulate in the OpenAI conversation — per-turn cost grows monotonically, and "send-only-on-change" caps writes but not accumulated context
Verified against the ported `report-service/functions/src/chat/openai.ts`: turns use
`openai.responses.create({ conversation, store: true, input: [newTurn] })`. With `store:true` +
Conversations state, **every** context snapshot the client ever attached stays in the conversation and is
reprocessed (and billed as input tokens) on **every** subsequent turn. The spec's "send context only when
it changes" reduces the *number* of snapshots but each large snapshot is permanent, so for a document the
student edits repeatedly the accumulated context (and per-turn cost) grows without bound within one
conversation. This compounds the already-known single-snapshot size risk — and that size is genuinely
unbounded: `exportAsJson` embeds full shared-model snapshots (`document-content.ts:151-166`, e.g. an entire
`SharedDataSet`'s rows) and full drawing-object arrays (`drawing-content.ts:132-151`); images are URL refs,
not the bloat source. Suggested resolution: acknowledge that "latest-context-wins" solves *correctness*
(stale doc) but not *cost accumulation*; note the hard spend cap is the only bound for the spike, and that
the deferred tool-calling upgrade (pull context on demand) is the real fix. Optionally cap/trim snapshot
size before send.

**Decision**: **Agreed — resolved via a redesigned context split (not just documentation).** Two changes
structurally bound the cost instead of only spend-capping it: (1) **LEFT (problem) is static** and is now
sent **once** on the first message (installed like the system prompt), so it never re-accumulates; (2)
**RIGHT (workspace) now sends a compact `documentSummarizer` markdown summary** (`shared/ai-summarizer/`,
already run server-side in `functions-v2`) instead of raw unbounded `exportAsJson` — so each on-change
refresh is small even as they accumulate. Latest-context-wins is scoped to RIGHT only (LEFT can't go
stale). The hard spend cap remains the backstop and tool-calling (deferred) is still the structural
end-state. Requirements ("Two-panel context…", backend "LEFT installed once, RIGHT refreshed on change",
"Latest-context-wins (RIGHT only)") and Technical Notes ("Context serialization — two paths") updated.
This also folds in Finding 7 (the "answer-key / it's the student's own work" rationale was corrected in the
same Technical Note: LEFT is authored curriculum, drawn from student-visible content only).

### Security Engineer

#### RESOLVED: "Dev/qa Firebase project" (Resolved deploy-target question) does not exercise the portal-JWT rules — only `appMode=authed` carries the claims
Verified: real portal-JWT auth happens **only** in `appMode === "authed"` (`src/lib/db.ts:173-176`
`signInWithCustomToken`); every other appMode signs in **anonymously** (`db.ts:181-183`
`signInAnonymously`) with **no** `platform_user_id`/`user_type`/`class_hash` claims, and routes to a
different Firestore subtree (`/dev|/qa|/test`) governed by permissive `isAuthed()`-only rules
(`firestore.rules:486-506`). The security-critical field-whitelisted rules live exclusively under
`match /authed/{portal}` (`firestore.rules:122`). So the Resolved answer "a CLUE dev/qa Firebase **project**
+ partition" (chosen precisely to "exercise the true rules/identity path") is misleading: a dev/qa
*project* is not a dev/qa *appMode*, and the unsecured `?appMode=dev|qa` shortcuts never evaluate the
`/authed/**` rules. To actually exercise them end-to-end you need a **portal-authenticated launch**
(`appMode=authed`) or **emulator tests with minted custom tokens** carrying the claims (the Testing note
already references the latter). Suggested resolution: tighten the Resolved deploy-target answer to say the
rules deliverable is validated via emulator-with-custom-tokens and/or a real portal launch, not via
`?appMode=qa`.

**Decision**: **Agreed.** Tightened the resolved "Which Firebase project / deploy target" question to state
the `/authed/**` rules only take effect in `appMode=authed`, and are validated by (primary)
Firestore-emulator tests with minted custom tokens and (secondary) a real portal launch — not by
`?appMode=qa`. Added the same caveat to the "Firestore rules are security-critical" risk bullet.

#### RESOLVED: "Rules modeled on CLUE's existing comment rules" points at the wrong precedent
Verified: CLUE comment **content** creates are written **server-side via a Cloud Function (admin SDK,
bypassing rules)** — `usePostDocumentComment` → callable `postDocumentComment_v2` →
`admin.firestore()...add()` (`functions-v2/src/post-document-comment.ts:43-44`). So the comment **create**
rule, though present in `firestore.rules`, is not the exercised path for comment content. The real
in-repo precedent for a **client-authored, field-whitelisted create/update** (which is what this spike's
client-writes-user-message design needs) is the **`history` create rule** (`firestore.rules:456-461`) and
the **rating `update` rule** (`isValidRatingUpdate`, `firestore.rules:425-431`). Suggested resolution:
repoint the Technical Note / Risk at `match /history` and `isValidRatingUpdate` as the templates. (The
prior self-review's stronger "net-new with no precedent" framing is also slightly off — a client-create
precedent does exist; it's just not the comment-create rule.)

**Decision**: **Agreed — and reframed per project-owner clarification: the tutor chat is its own new
collection with its own fresh rules, so it doesn't "reuse existing comment rules" at all.** Rewrote the
Technical Notes "Firestore / identity" bullet and the backend "Security rules" requirement to say: new
collection, new rules, authored in CLUE's identity idiom (`request.auth.token.*` claims, `isAuthed()`,
`userIsRequestUser()`); mirror the comments subcollection only for **path/keying** shape (on
`networkDocumentKey` + claims); and if a client-create *example* is wanted, copy `match /history` /
`isValidRatingUpdate`, not the server-side comment-create rule. Also noted `teachers[]` on doc records is
deprecated (folds in a Finding-10 nit).

#### RESOLVED: "No answer-key concern here (it is the student's own work)" is the wrong rationale for the LEFT panel
Verified: the LEFT context (Resolved: "current problem/curriculum section") is **authored curriculum**,
not the student's own work — so the stated justification only applies to the RIGHT workspace panel. The
Teacher Guide is a separate `ProblemModel` serializing through the **same** `exportAsJson` path
(`stores.ts:88`, gated to teachers via `nav-tab-panel.tsx`). The students-only launcher gate (Resolved Q1)
mitigates the teacher-guide leak vector in practice, but two things remain: (1) fix the rationale — LEFT =
authored reference content, and (2) whether ordinary student-visible problem sections ever embed
hints/solutions is an authoring-content question not enforced by code, so the context builder should
choose its source deliberately and explicitly exclude any teacher-facing document. Suggested resolution:
correct the parenthetical and add a note that the context source is student-visible content only.

**Decision**: **Agreed — fixed alongside Finding 4.** The Technical Notes "Context serialization" entry now
states LEFT is authored curriculum (reference content, not the student's own work), that the builder draws
LEFT from student-visible problem content only, and that no teacher-facing document (the Teacher Guide, a
separate `ProblemModel` on the same `exportAsJson` path) is serialized; the students-only launcher gate
already prevents teacher-guide exposure in the spike. The misleading parenthetical was removed.

### WCAG Accessibility Expert

#### RESOLVED: Reuse CLUE's accessibility-tools instead of porting AP's hand-rolled focus code; the launcher auto-joins the header's roving arrow-key order
Verified: the CLUE header is **already** wired into a managed roving-tabindex region via the in-repo
accessibility package — `clue-app-header.tsx:39-46` calls `useClueAccessibility({ type:"region",
navigation:{ itemSelector: "button, .custom-select .header[role='button']", orientation:"horizontal" }})`
on `headerRef` (attached to both header roots). Consequences the spec's accessibility requirement should
make concrete: (1) a plain `<button>` launcher dropped into `.right` will be **automatically captured** by
that `itemSelector` and become a horizontal arrow-key stop — so "must not regress header tab order" is a
real, verifiable constraint, and the author must confirm the launcher lands in the intended position in
the arrow sequence; (2) CLUE already has a `FocusTrapController` in the accessibility-tools package (used
for tiles) — the drawer's focus management should **reuse** it rather than port AP's manual focus-in /
restore-to-launcher code, keeping the drawer consistent with CLUE's focus model. Suggested resolution:
reword the "integrate with CLUE's keyboard navigation" requirement to name `useClueAccessibility` /
`FocusTrapController` as the integration points and add "launcher verified in header arrow-order" to the
acceptance behaviors.

**Decision**: **Agreed — with a spot-checked correction to the primitive.** Verified the package API: the
drawer (function components) should use the **`useFocusTrap`** hook, not `FocusTrapController` (that's the
class-component variant). `useFocusTrap({ containerRef, strategy, enabled })` → `{ isTrapped, enterTrap,
exitTrap }` provides Tab/Shift+Tab containment + Escape + SR announcements, and is general-purpose (not
tile-only). Two honest caveats now in the requirement: its default ergonomics are tuned for the tile
pattern (Enter-to-enter, Escape-returns-to-container), so the drawer drives it **active-on-open** with a
custom escape/onExit that closes the drawer; and the **focus-in-on-open / restore-to-launcher-on-close**
round-trip stays drawer-owned (the trap restores to its container, not an external launcher). Reworded the
"CLUE accessibility integration" bullet accordingly with explicit acceptance behaviors.

### Teacher / Education Researcher

#### RESOLVED: Students-only gating leaves teachers/researchers with no in-app view of tutor transcripts, yet the pilot's purpose is to evaluate usefulness
Verified: the launcher is gated to `user.isStudent` (Resolved Q1), and there is no teacher/researcher UI
for reading chat transcripts (the existing chat panel is a different feature). Transcripts persist in
Firestore (Resolved Q3), so they are *inspectable by a developer*, but a piloting teacher or the
evaluating researcher has no in-product visibility into what the tutor told students — which is in tension
with the spike's stated goal ("learn whether a contextual, document-aware tutor is useful"). This may be
an accepted spike limitation (Firestore inspection suffices for the evaluators), but it should be stated
explicitly rather than left implicit. Suggested resolution: add an Out-of-Scope or Risks note that the
spike provides **no teacher/researcher observer UI**; transcript review is via Firestore/emulator
inspection only, and teacher preview is deferred (consistent with "a role list can be added later").

**Decision**: **Agreed — documented as out-of-scope (no design change).** Added an Out of Scope entry:
"Teacher/researcher observer UI for tutor transcripts — none; transcripts reviewed via Firestore/emulator
inspection only for the spike; in-product teacher preview/observation deferred." An observer UI is out of
scope for a spike and Firestore inspection suffices for the small-pilot evaluators; the only fix needed was
to state it explicitly.

### Factual corrections (accuracy nits, verified)

#### RESOLVED: Small factual inaccuracies in Technical Notes
- **Stores list.** Technical Notes says the header exposes "`appConfig, appMode, user, groups, ui, unit,
  problem`." Verified the component destructures **ten** (`clue-app-header.tsx:33`: also `appVersion`, `db`,
  `investigation`) and `useStores()` exposes the **full** store set — notably `persistentUI`, which already
  owns the existing chat-panel toggle state. Minor, but relevant to the collision finding.
- **`chat` URL param.** "CLUE's existing URL-param handling is reused" slightly overstates it: `chat` is
  **not** in CLUE's `booleanParams` allowlist nor the `QueryParams` interface (`src/utilities/url-params.ts`).
  Enabling it is a two-line add (field + allowlist entry). The good news the spec can rely on: CLUE's
  `processBooleanValue` (`url-params.ts:163-173`) already implements the exact `?chat`/`?chat=true` on,
  absent/`?chat=false` off semantics.
- **`teachers[]` field.** Technical Notes lists docs as carrying "`context_id`, `teachers[]`, `network`,
  `uid`." Per `firestore.rules:393-396`, inline `teachers[]` on **document** records is a **deprecated**
  pattern (current docs authorize via `context_id`→class lookup). A new chat parent doc should not
  replicate `teachers[]`.

**Decision**: **Resolved — all four folded into earlier fixes.** Stores list → app-header Technical Note
(Finding 3); `chat`→`chatTutor` param + `booleanParams`/`QueryParams` add + `processBooleanValue` semantics
→ Gating requirement (Finding 3); `teachers[]`-deprecated → Firestore/identity Technical Note (Finding 6);
context-size bloat source (embedded `sharedModels` / drawing objects, not images) → "Context serialization"
Technical Note (Finding 4).

---

## Self-Review — Pass 3 (code-verified, 2026-07-07)

Third multi-role pass. Every finding below was verified against the **actual** installed code before
being written — CLUE working tree (`CLUE-566-add-ai-chat`), the two source branches
(`activity-player@AP-118-add-chat-sidebar`, `report-service@REPORT-73-chat-tutor-backend`), the
**installed** `@concord-consortium/accessibility-tools` dist, and live Node execution of the OpenAI/
firebase-functions SDK surfaces. Evidence cited inline as `file:line`. Findings are new relative to
Pass 1/Pass 2 (which this pass does not re-litigate).

### Firebase Cloud-Functions Engineer

#### RESOLVED: BLOCKER — `functions-v2` ships `openai@^4.64.0`, which has **no** `responses`/`conversations` API; the "verbatim `openai.ts` port" cannot run as-is
The spec says REPORT-73's `openai.ts` "ports nearly verbatim" (Requirements → Backend; Overview). Verified
this is **false in CLUE's environment**: REPORT-73's `openai.ts` calls `openai.conversations.create()`,
`openai.conversations.items.create(...)`, and `openai.responses.create({conversation, store:true, ...})`
against `openai@^6.45` (`report-service/functions/package.json`; the file header pins `openai@6.45`).
CLUE `functions-v2` pins **`openai@^4.64.0`** (installed 4.64.0). Live surface test against CLUE's installed
SDK: `openai.responses → undefined`, `openai.conversations → undefined`, only `chat.completions.create` exists.
Dropping `openai.ts` in verbatim would throw `TypeError: Cannot read properties of undefined` at the first
`conversations`/`responses` call. **Resolution:** state that the port requires bumping `functions-v2`'s
`openai` dependency to `^6.x` (matching report-service), and that the bump must be validated against the
existing LangChain path (`@langchain/openai@^0.6.7` in `functions-v2` pins a nested `openai@5.12.2`; the
top-level bump must not break `get-ai-content.ts` / `on-class-data-doc-written.ts`). Reword "ports nearly
verbatim" → "ports verbatim *after* an `openai` SDK upgrade." (Verified: `firebase-functions@5.1.1` v1
interop, `defineSecret`, and the lock/drain/context-composition separability claims are all TRUE — only the
`openai` SDK version is the problem.)

**Decision**: **Agreed.** Reworded the backend `onWrite`/lock-drain bullet ("ports verbatim **after an
`openai` SDK upgrade**") and the OpenAI bullet, which now carries the explicit backend prerequisite: bump
`functions-v2` `openai` `^4.64` → `^6.x` and verify against the existing LangChain path. Everything else
about the port (v1 interop, `defineSecret`, lock/drain, context-composition separability) is verified sound.

#### RESOLVED: 1st-gen trigger's no-retry assumption must be preserved on paste into the all-2nd-gen `functions-v2`
Verified `functions-v2` is currently 100% 2nd-gen (`firebase-functions/v2/*`) on `engines.node:"20"`;
REPORT-73's `chatTutorOnWrite` is 1st-gen and its own comment states it "must run with the DEFAULT no-retry
policy" (an infinite re-drain hazard otherwise). Coexistence is supported (verified), so this is not a
blocker — but two config-awareness items are captured in the backend "Keep the ported trigger 1st-gen"
requirement bullet: (1) keep it 1st-gen (do **not** "modernize" to 2nd-gen `onDocumentWritten`, which is
at-least-once/Eventarc and would reintroduce the re-drain hazard), and (2) set an explicit region (1st-gen
defaults to `us-central1`, unlike the 2nd-gen functions). Also note `functions-v2`'s `tsc` build is `strict` + `noUnusedLocals`, so a verbatim paste may
need minor lint/TS fixups to pass predeploy.

**Decision**: **Agreed — folded into the backend bullet.** The `onWrite`/lock-drain requirement now states:
keep the trigger 1st-gen (do not modernize to 2nd-gen `onDocumentWritten`), set an explicit region, and
expect minor `strict`/`noUnusedLocals` fixups on paste.

### WCAG Accessibility Expert

#### RESOLVED: `useFocusTrap`'s `enabled` config is a **no-op in the hook** — the spec's "driven active-on-open via `enabled`" is unsound as written
The spec (CLUE accessibility bullet) says to drive the drawer trap "**active-on-open** (`enabled` +
imperative `enterTrap()`)". Verified against the **installed** dist
(`node_modules/@concord-consortium/accessibility-tools/dist/hooks/index.js`): the `useFocusTrap` hook
**never reads `config.enabled`** — it destructures only `containerRef` and `strategy` (`index.js:148-149`)
and installs its document-level capture-phase `keydown`/`focusin` listeners unconditionally once mounted
with a config. `enabled` is honored **only** by the separate `FocusTrapController` **class** (`setEnabled()`,
`index.js:485-506`). Consequence: if the drawer stays mounted while visually closed, Enter/Tab on its
container are still intercepted. **Resolution:** change the mechanism to one that actually works — either
(a) **unmount** the drawer (and hook) when closed, (b) pass `useFocusTrap(undefined)` when closed (the hook
early-returns `null` and installs no listeners), or (c) use `FocusTrapController` + `setEnabled()`. Also
record two verified caveats the bullet should absorb: **version skew** — CLUE ships `0.1.0-pre.1`, but the
local working copy at `~/projects/accessibility-tools` is the **older** `0.0.1-pre.1` whose hook does *not*
invoke `escapeHandlers` at all; and SR announcements + composer-focus-on-open are **strategy-driven**
(`announceEnter`/`announceExit`, `cycleOrder`), not automatic — `enterTrap()` focuses the first `cycleOrder`
slot, not the composer, so the drawer's strategy must place initial focus explicitly.

**Decision**: **Agreed — recommended mechanism adopted.** Rewrote the "Drawer focus management" bullet to
gate the trap by **config presence** (`useFocusTrap(undefined)` when closed) instead of the no-op `enabled`
flag, and to state that SR announcements + composer-focus-on-open are strategy-driven and that the
`0.1.0-pre.1` installed contract (not the older local `0.0.1-pre.1`) is the target. Also folded in the
"AP has no focus containment, so this is a new capability not a port" correction (Finding 10 wording).

#### RESOLVED: header roving-tabindex captures the launcher among **all** header controls and does **no** disabled/visibility filtering
The spec frames header auto-capture as upside ("verify it lands in the intended position"). Two verified
sharpenings: (1) `useClueAccessibility` attaches to the whole `<header>` root (`clue-app-header.tsx:39-46,
203,284`), so arrow order spans `.left` + `.middle` + `.right` in DOM order — the launcher is sequenced
after every existing left/middle control, not just among `.right`. (2) `useKeyboardNav.queryItems` uses the
raw `itemSelector` with **no** `:not([disabled])` or visibility filter, so a launcher disabled "while the
tutor is generating" would **remain an arrow-key stop** (already true today: the disabled `CustomSelect` in
the student header is an arrow stop). **Resolution:** note that the launcher's position is
DOM-insertion-determined (place it deliberately) and that it must not be `disabled` as its busy state, or it
will trap an arrow stop on a non-actionable control.

**Decision**: **Agreed — folded into the accessibility acceptance behaviors.** The launcher-arrow-order
acceptance already exists; added the "position is DOM-insertion-determined, spans the whole header" and
"do not use `disabled` as the launcher's busy state" caveats to the drawer/launcher bullet.

### Frontend / React Integration Engineer

#### RESOLVED: `documentSummarizer` API is mis-described — import path, export kind, and the `getSnapshot` framing are wrong
Verified in `shared/ai-summarizer/`: (1) `documentSummarizerWithDrawings` is **not** in `ai-summarizer.ts`
and is **not** a named export — it lives in `ai-summarizer-with-drawings.ts:21` as a **default export**, so
the import implied by the spec would fail to compile. (2) The spec says `documentSummarizer` takes
"`getSnapshot(document.content)`"; the real signature is `documentSummarizer(content, options)` and **no**
call site uses `getSnapshot` — `ai-tile.tsx:62` passes the **live MST node** `document.content` directly, and
the function internally `JSON.stringify`s then `JSON.parse`s it (`ai-summarizer.ts:78-95`). (3) The
`{rowOrder, rowMap, tileMap, sharedModelMap}` shape and the `minimal` option are correct; the browser-only
nature of the drawings variant is correct. **Resolution:** fix the import path/export kind and drop the
`getSnapshot` framing (pass `document.content`). Add the verified cost caveat below.

**Decision**: **Agreed.** Fixed the RIGHT bullet (Requirements) and the RIGHT serialization Technical Note:
`documentSummarizer` is a named export of `ai-summarizer.ts` called with `document.content`;
`documentSummarizerWithDrawings` is the **default** export of `ai-summarizer-with-drawings.ts`; dropped the
`getSnapshot` framing.

#### RESOLVED: computing the RIGHT summary on every send is a full stringify+parse+normalize of the whole document — cost is not obviously "cheap"
Verified `documentSummarizer` does `JSON.stringify(content, null, 2)` → `JSON.parse` → full `normalize`
per call (`ai-summarizer.ts:78-101`), over a document whose `exportAsJson` embeds unbounded shared-model
rows and drawing-object arrays (`document-content.ts:151-167`, `drawing-content.ts:132-152`). The spec's
send-on-change hashing already caps *network/context* growth, but the client still recomputes the full
summary (to hash it) on **every send**. For a large workspace this is non-trivial main-thread work.
**Resolution:** note that the RIGHT summary+hash should be memoized/recomputed only on document change (not
per keystroke), consistent with the observer-driven re-key in the next finding.

**Decision**: **Agreed.** Added the "recompute only on document change (memoized), not per keystroke/send"
caveat to the RIGHT bullet and the RIGHT serialization Technical Note.

#### RESOLVED: the app-header launcher has no wired path to the current workspace document key
The spec keys one conversation per workspace document, but the header is not wired to know which document
that is. Verified: `clue-app-header.tsx:33` destructures ten stores, **none** is `persistentUI`; the correct
source of the center workspace doc key is `persistentUI.problemWorkspace.primaryDocumentKey`
(`persistent-ui.ts:44`, `workspace.ts:23,29-30`) — **not** `persistentUI.focusDocument`, which returns the
*left/resource* document or a section path (`persistent-ui.ts:70-77`). Two frictions: `primaryDocumentKey`
is `types.maybe` (undefined before a doc opens → launcher must handle a keyless state), and the value must be
read **during render** (the component is an `observer`) for the conversation to re-key on document switch —
reading it lazily in the click handler would not. **Resolution:** add `persistentUI` to the header, source
the key from `problemWorkspace.primaryDocumentKey`, and specify keyless-state + re-key-on-switch behavior in
the requirements (keyless-state now resolved by IC-5: the launcher is hidden while the key is undefined).

**Decision**: **Agreed.** Added a "Sourcing the current workspace document key" Technical Note: source from
`persistentUI.problemWorkspace.primaryDocumentKey` (not `focusDocument`), add `persistentUI` to the header's
destructure, handle the `types.maybe` keyless state, and read during render (observer) to re-key on switch.

### Security Engineer

#### RESOLVED: transcript **read** rule must be owner-only — the natural CLUE precedent (documents read) would leak transcripts class-wide
The spec says to mirror the comments subcollection for path/keying and points at `match /history` /
`isValidRatingUpdate` for client-create shape, but does **not** pin the **read** rule. Verified risk: CLUE's
`documents` read rule grants access via `resourceInUserClass()` (`firestore.rules:352,177-179` —
`class_hash == resource.data.context_id`), i.e. **any student in the same class could read another
student's transcript**, and its `resource == null` branch allows probing. The AI-tutor transcript is
private student work + chat; a class-wide read is a real cross-student leak. The **history** read rule
(`firestore.rules:458`) is the correct template: owner-only for students (`userOwnsDocument()`) plus
teacher/researcher. **Resolution:** mandate the history-style **owner-only** read for the chat collection and
explicitly forbid the `resourceInUserClass()` branch; add to the security-rules acceptance check.

**Decision**: **Agreed.** Added an owner-only read requirement to the backend "Security rules" bullet and the
Firestore/identity Technical Note, and named it as an acceptance criterion in the Risks "security-critical"
bullet — explicitly forbidding the `documents` rule's class-wide `resourceInUserClass()` branch.

#### RESOLVED: field-whitelist template correction — no existing CLUE **create** rule uses `keys().hasOnly`; `match /history` is owner-gated but **not** field-whitelisted
Pass 2 repointed the client-create template at `match /history` / `isValidRatingUpdate`. Verified nuance:
`match /history` create (`firestore.rules:456-461`) is a genuine owner-gated client create but writes
**arbitrary fields** (no `keys().hasOnly`); only `isValidRatingUpdate` (`:425-431`) truly whitelists fields,
and it is an **update**, not a create. Existing create rules use `hasAll` (permits extras), never `hasOnly`.
So the chat's field-whitelisted **create** (the property that blocks a client forging `kind:'assistant'` or
writing server-owned lock fields — exactly REPORT-73's `chatMessageCreate` `keys().hasOnly([...])` at
`report-service/firestore.rules:172`) introduces a **stricter** pattern than any current CLUE create
precedent. **Resolution:** correct the Technical Note to say: use `isValidRatingUpdate` as the *field-whitelist*
model and `match /history` as the *owner-gated-create* model, and expect to author a `keys().hasOnly` create
rule that has no existing in-repo create precedent (port REPORT-73's `chatMessageCreate` shape).

**Decision**: **Agreed.** Corrected the backend "Security rules" bullet and the Firestore/identity
"Client-create template" Technical Note: `isValidRatingUpdate` = field-whitelist model, `match /history` =
owner-gated-create model (not field-whitelisted), and the chat's `keys().hasOnly` create is stricter than any
existing CLUE create — port REPORT-73's `chatMessageCreate` shape.

#### RESOLVED: rules cannot rate-limit — a single authenticated student can exhaust the shared spend cap; prefer create-only trigger
The spec's only spend bound is a global hard cap. Verified: Firestore rules cannot throttle writes and there
is no per-user throttle anywhere in `functions-v2/src`. Since the client writes `user` docs directly and an
`onWrite` trigger fires the paid OpenAI call, one student scripting rapid sends can burn the **entire shared
budget** for everyone (budget-exhaustion DoS) well within the "cap." Also, REPORT-73's trigger is `onWrite`
(create **and** update); a student re-saving/editing a message doc could re-fire — the per-conversation lock
and self-trigger guard bound concurrency and self-writes, not total user-initiated volume. **Resolution:**
acknowledge the per-user angle explicitly in Risks (the global cap bounds *total* spend, not *per-student*
fairness), note that create-only trigger semantics + a lightweight per-user/per-minute quota are the real
mitigations (deferred, but named), so the spike doesn't imply the cap solves abuse.

**Decision**: **Agreed.** Reworded the Risks "Spend / abuse" bullet to "bounded, but not per-student" (the
cap bounds total spend, not per-student fairness; budget-exhaustion + `onWrite` re-fire risks named), and
added the rate/abuse note to the Firestore/identity Technical Note. Real mitigations (create-only trigger +
per-user quota) named as deferred.

### Factual corrections (verified, low-severity)

#### RESOLVED: small source-fidelity wording fixes
- **"AP's manual Tab handling" does not exist.** The Backend/accessibility bullet says to use `useFocusTrap`
  "rather than porting AP's manual Tab handling," but AP's chat components have **no** Tab/Shift+Tab handling
  and **no** focus containment (verified: grep of `activity-player` chat files finds none) — AP only does
  focus-in-on-open + restore-on-close. So `useFocusTrap`'s containment is a **new** capability, not a port;
  the spec's own Pass-2 WCAG finding states this correctly, so the requirement bullet is internally
  inconsistent. Reword to "AP has no focus containment; add it via `useFocusTrap`."
- **Transports port as a *seam*, not as classes.** "Keep AP's `DebugTransport` and `FirestoreTransport`"
  understates that both concrete classes are AP/report-service-specific (AP log-sinks, AP page-context types,
  report-service prompt-file names in the debug narrative, AP's `/sources/.../pages/{pageId}` Firestore path).
  Only the `ChatTransport` **interface** ports; both transports are substantially rewritten for CLUE's
  LEFT-JSON/RIGHT-markdown payloads and keying. Reword accordingly.
- **AP LEFT context is a "developer-role item," not a "system prompt."** AP's `openai.ts:5-6` explicitly
  notes the installed page context is a persistent **developer-role conversation item**, deliberately *not*
  the OpenAI `instructions`/system-prompt surface. Functionally equivalent for the spec's argument; tighten
  the wording where it says "installed once as a persistent system prompt."

**Decision**: **Agreed — all three applied.** "AP's manual Tab handling" reworded to "AP has no focus
containment; add it via `useFocusTrap`" (Drawer bullet); the Transport-abstraction bullet now says only the
`ChatTransport` *interface* ports and both concrete transports are substantially rewritten; and the
Background "persistent system prompt" phrase is now "persistent developer-role conversation item (not the
OpenAI `instructions`/system-prompt surface)."

---

## Self-Review — Pass 4 (code-verified, 2026-07-08)

Fourth multi-role pass, run with five code-verification-focused roles (Backend/Cloud-Functions, Security,
WCAG Accessibility, Frontend/React, Senior Engineer / internal consistency). **Every finding below was
verified against the actually-installed code before being written** — the CLUE working tree
(`CLUE-566-add-ai-chat`), the two source branches (`activity-player@AP-118-add-chat-sidebar`,
`report-service@REPORT-73-chat-tutor-backend`), the **installed** `@concord-consortium/accessibility-tools@0.1.0-pre.1`
dist, and live Node execution of the OpenAI / firebase-functions SDKs. Evidence cited inline as `file:line`.
Findings are new relative to Passes 1–3. A notable outcome of this pass is that it **overturns two claims
prior passes marked "verified"** (the header roving-tabindex auto-capture, A11Y-1; and the
`keys().hasOnly`-blocks-forgery mechanism, SEC-1).

Verification note: the full Backend re-verification returned **no** stale claims — every backend assertion
(firebase-functions v1 interop, the `openai@4.64` vs `^6` blocker, the lock/drain/cursor shape, `strict` +
`noUnusedLocals`) was re-confirmed TRUE against installed code, and the `openai@4→^6` bump was affirmatively
proven LangChain-safe (`^5`/`^6` cannot npm-dedupe, and no `functions-v2/src` file imports the raw `openai`
SDK). Those are folded in as informational notes, not issues.

### WCAG Accessibility Expert

#### RESOLVED: A11Y-1 (HIGH) — the header roving-tabindex region is **not functionally wired**, so the launcher will **not** be "auto-captured as an arrow-key stop" as the spec asserts
The spec's central header-integration premise (Requirements "Integrate with CLUE's keyboard navigation",
lines ~127–136; Pass-2 finding lines ~806–819) states that because the header calls `useClueAccessibility({
type:"region", navigation:{ itemSelector:"button, …" }})`, a plain `<button>` launcher dropped into `.right`
is **auto-captured** as a horizontal arrow-key stop. **Verified false against current code:**
- `clue-app-header.tsx:39-46` calls `useClueAccessibility(...)` and **discards the return value** (no
  assignment); the `<header>` roots (`:203`, `:284`) have **no `onKeyDown`**, and grep finds **no**
  `getItemProps`/roving `tabIndex`/`handleKeyDown` anywhere in the header.
- `useClueAccessibility` region path just returns `useAccessibility({navigation,…})`
  (`use-clue-accessibility.ts:177-181`).
- In the installed dist, `useKeyboardNav` only **returns** `handleKeyDown` (`dist/hooks/index.js:922`) — it
  never attaches it. `useAccessibility` (`:1259-1289`) calls `useKeyboardNav` and its only region-side effect
  (`:1265-1277`) is announcement bookkeeping; it returns `navigation` for the **caller** to wire. The only
  `addEventListener("keydown", …)` calls in the dist belong to `useFocusTrap` (`:379-380`) and the
  `FocusTrapController` class (`:475-476`), not to the navigation region.
Consequence: today the header establishes **no** arrow-key traversal and applies **no** roving tabindex — its
buttons are ordinary Tab stops. Two of the spec's acceptance behaviors ("launcher verified in the header
arrow-order", "does not regress the header's arrow sequence") and both "verified caveats" (whole-header DOM
order; disabled-stays-a-stop) rest on a region that, as coded, does not navigate.
**Suggested resolution:** either (a) correct the spec to state the header roving region is **not yet
functionally wired** (arrow-nav is aspirational or owned by the in-progress keyboard-nav work), and drop the
"auto-captured arrow stop" guarantee — the launcher is a normal Tab stop for the spike; or (b) make wiring
the region's `handleKeyDown` + roving tabindex onto the header a **prerequisite task** before the launcher can
rely on it. Confirm with the active CLUE keyboard-nav effort which is intended.

**Decision**: **Agreed — option (a).** The launcher is a plain **Tab** stop for the spike (fully accessible;
arrow-roving is a nicety the spike doesn't need). Rewrote the "Integrate with CLUE's keyboard navigation"
bullet to state the header region is not currently wired for arrow roving (return discarded, no
`onKeyDown`/roving `tabIndex`; `useKeyboardNav` only returns `handleKeyDown`), dropped the "auto-captured
arrow stop" guarantee, and changed the acceptance behavior from "launcher verified in the header arrow-order"
to "launcher reachable as a Tab stop (not disabled while busy)." Kept the "don't use `disabled` as busy
state" caveat. Wiring the header region for roving is out of scope; the launcher would inherit it if the
separate CLUE keyboard-nav work lands it.

---

#### RESOLVED: A11Y-2 (MEDIUM) — `onExit`-based launcher restore is clobbered by the trap's unconditional `container.focus()`; "escapeHandlers/onExit" are not interchangeable
The spec treats close-on-Escape as "wired via a custom `escapeHandlers`/`onExit`" and restore-to-launcher as
"drawer-owned" (lines ~152, ~156–157). Verified in the installed dist: on the Escape path the hook runs
`strategy.onExit?.()` (`dist/hooks/index.js:302`) and then **unconditionally** `container.focus()` (`:308`);
`exitTrap()` does the same (`:442`→`:444`). So any `launcher.focus()` performed **inside `onExit`** is
immediately overwritten by the trap focusing its own container. To land focus on the launcher the drawer must
either return `"handled"` from an `escapeHandlers[slot]` (which **skips** the exit + `container.focus()`,
`:293-297`) or tear down by **unmounting** (the cleanup effect at `:412-418` calls `onExit` with **no**
`container.focus()`).
**Suggested resolution:** replace "escapeHandlers/onExit" with an explicit instruction — own close +
launcher-restore in an `escapeHandlers`→`"handled"` handler (or by unmounting the drawer), because plain
`onExit` fires *before* the trap's `container.focus()`.

**Decision**: **Agreed.** Rewrote the drawer-focus bullet: close + launcher-restore must not rely on plain `onExit` (the trap runs `container.focus()` right after `onExit` on both exit paths). Use an `escapeHandlers[slot]`→`"handled"` handler (skips the trap's exit + container focus) and restore focus yourself, or unmount the drawer (cleanup calls `onExit` with no `container.focus()`).

---

#### RESOLVED: A11Y-3 (LOW–MEDIUM) — a mouse-initiated open without `enterTrap()` leaves the drawer keyboard-dead
When the trap config becomes defined, the hook's mount effect calls `setChildrenNonTabbable()`
(`dist/hooks/index.js:223-225`), setting `tabindex="-1"` on **every** focusable descendant of the container;
tabbability is only restored inside `enterTrap()` (`:425`). The spec says "then `enterTrap()` on open," which
is correct — but if an implementer gates `enterTrap()` to *keyboard*-initiated opens (a common pattern), a
**mouse** click that opens the drawer leaves the composer and all controls at `tabindex=-1` (unreachable by
keyboard) and never sets initial focus.
**Suggested resolution:** state that `enterTrap()` must run on **every** open (mouse and keyboard), after the
hook's mount effect, or the drawer's controls stay non-tabbable.

**Decision**: **Agreed.** Added an explicit "`enterTrap()` must run on EVERY open (mouse or keyboard)" bullet — otherwise the hook's mount-time `setChildrenNonTabbable()` leaves the drawer's controls at `tabindex=-1` and initial focus unset on a mouse-opened drawer.

---

#### RESOLVED: A11Y-4 (NIT) — stale dist line citation for the `useFocusTrap` facts
The spec cites `index.js:485-506` for "installs listeners unconditionally / `useFocusTrap(undefined)`
early-returns null" (lines ~925–938). In the installed dist those facts live at `:379-381` (listener install)
and `:419` (early return); `:485-506` is `FocusTrapController.setEnabled…enterTrap`, which supports only the
*separate* "`enabled` is controller-only" claim. **Suggested resolution:** fix the line citation.

**Decision**: **Agreed — addressed where it matters.** The active "Drawer focus management" requirement bullet now cites the correct installed-dist lines (`dist/hooks/index.js:379-381` for listener install, `:419` for the `undefined` early-return). The stale `:485-506` citation survives only in the Pass-3 finding narrative, which is left intact as a decision log.

---

### Security Engineer

#### RESOLVED: SEC-1 (MEDIUM–HIGH) — `keys().hasOnly` does **not** block `kind:'assistant'` forgery; the spec's prose misattributes the mechanism
The spec says a "`keys().hasOnly([...])` create … blocks a client forging `kind:'assistant'`" (Requirements
"Security rules" ~229–231; Technical Notes ~315–334). **False as stated:** `hasOnly` constrains *which keys*
are present, not their *values*. The source rule `report-service/firestore.rules:172-189` (`chatMessageCreate`)
blocks kind-forgery with a **separate explicit value check** — `request.resource.data.kind == 'user' || … ==
'log'` (`:176`) — **in addition to** `keys().hasOnly(...)` (`:184`). An implementer who follows the spec's
prose literally (whitelist that includes `'kind'`, no value assertion) would ship a rule that lets a client
inject a forged assistant reply.
**Suggested resolution:** state that the create rule must **assert `request.resource.data.kind == 'user'`
explicitly** (value check), not rely on `hasOnly`; `keys().hasOnly` only blocks *extra* fields (e.g.
server-owned lock/cursor), it does not constrain `kind`'s value.

**Decision**: **Agreed.** Corrected the Requirements "Security rules" bullet and the Technical Notes
"Client-create template" to split the two jobs explicitly: (a) `keys().hasOnly` blocks extra/server-owned
fields; (b) an explicit `kind == 'user' || kind == 'log'` **value** assertion is what blocks the forged
`kind:'assistant'` reply. Folded SEC-2's `createdAt` guard into the same corrected passages.

---

#### RESOLVED: SEC-2 (MEDIUM) — spec omits the load-bearing `createdAt` presence/orderable-type guard the source create rule enforces
`report-service/firestore.rules:180-183` requires `'createdAt' in request.resource.data` **and**
`createdAt is timestamp || is int || is float`, with a comment that a missing/non-orderable `createdAt` "would
silently burn a lock cycle with no reply, or wedge ordering for the conversation" (the drain orders by it).
CLUE reuses the same tie-safe `{createdAt, messageId}` drain cursor (Requirements ~170), so the same guard is
needed — but the spec's create-rule template (~222–235, ~328–334) never mentions it.
**Suggested resolution:** carry the `createdAt` presence + orderable-type assertion into the CLUE create rule
as part of the ported `chatMessageCreate` shape.

**Decision**: **Agreed — folded into SEC-1's fix.** The `createdAt` presence + orderable-type guard is now
named in both the Requirements "Security rules" bullet and the Technical Notes "Client-create template" as a
required part of the ported `chatMessageCreate` shape.

---

#### RESOLVED: SEC-3 (MEDIUM) — the recommended owner-only **read** helpers are lexically scoped to `match /documents/{docId}`; the template only compiles if the chat is a subcollection there, which contradicts "own new collection(s)"
The spec's read template copies `firestore.rules:458` verbatim (`userOwnsDocument() || teacherCanAccessDocument()
|| researcherCanAccessDocument()`). Verified: all three helpers are defined **inside** `match /documents/{docId}`
(`:439`, `:401`, `:405`) and depend on `getDocumentData()` = `get(.../documents/$(docId))`. They resolve only
if the transcript is a subcollection **under `documents/{docId}`** (like `comments`/`history`). But the spec
elsewhere says the chat lives in "its **own new collection(s)**" (~217, ~315). If that is read as a top-level
`/authed/{portal}/<chat>` collection, those helpers are out of scope and won't compile.
**Suggested resolution:** state explicitly that the chat parent/messages are a **subcollection of
`documents/{docId}`** (so the `documents`-scoped helpers are in scope), **or** re-implement the
owner/teacher/researcher checks locally against the chat doc's own `uid`/`context_id`. This also reconciles the
path/keying note (which points at the `comments` subcollection shape).

**Decision**: **Agreed — option (b): top-level, self-contained collection.** Chosen because the spike runs on
the staging project and may be removed afterward — a top-level collection can be deleted wholesale to purge all
chat data. Consequence: the `documents`-scoped owner/teacher/researcher helpers are out of scope and the rules
**re-implement** ownership locally (`request.auth.token.platform_user_id == resource.data.platform_user_id`).
Updated the Requirements "Security rules" bullet (new "Self-contained top-level collection" + rewritten
"Owner-only read"), and the Technical Notes "Path / keying" and "Read rule" bullets accordingly.

---

#### RESOLVED: SEC-4 (MEDIUM) — `networkDocumentKey` is not an access-control boundary, and the existing document-create rule does not pin `uid` to the token; the owner field the read rule trusts could be client-set
The spec frames "root and key the new collection on `networkDocumentKey(uid, documentKey, network)` + portal
claims" as the isolation mechanism (~322–326). Rules do not parse document IDs, so the `uid:${uid}` prefix in
the key (`shared/shared.ts:117`) enforces **nothing** — isolation rests entirely on rules checking
`resource.data.uid`. Critically, the existing `isValidDocumentCreateRequest` (`firestore.rules:144-148`) does
**not** call `userIsRequestUser()` — it validates only `context_id`/`class_hash`, so `data.uid` on a
`documents/{docId}` record is **not** pinned to the creator's token. If the chat-parent doc is created under
that rule, its `uid` (which `userOwnsDocument()` trusts for reads) is client-settable. The source
`chatParentCreate` (`report-service/firestore.rules:164-169`) avoids this by wrapping an owner-identity check.
**Suggested resolution:** require the chat-parent create rule to include `userIsRequestUser()` (or an
equivalent `request.resource.data.uid == <token uid claim>` assertion) so the owner field the read rule trusts
is authentic — do not assume the key prefix or the existing document-create rule provides it.

**Decision**: **Agreed.** Added an "Owner pinned at create" requirement to the Security rules bullet:
`request.resource.data.platform_user_id == request.auth.token.platform_user_id` on both parent and message
create, so the owner field the (locally-implemented, SEC-3) read rule trusts is authentic. Explicitly not
leaning on the `documents` create rule, which doesn't pin the owner to the token.

---

#### RESOLVED: SEC-5 (LOW–MEDIUM) — the copied read template grants class-wide teacher + researcher read of PII-bearing transcripts, which conflicts with the students-only / no-observer-UI design
The template `… || teacherCanAccessDocument() || researcherCanAccessDocument()` (`firestore.rules:458`, endorsed
at ~224–227) lets **any** teacher/researcher whose `class_hash == context_id` (or in-network) read a student's
private tutor transcript. The spec labels this "owner-only read (required)" (~338–341) yet the design is
students-only with "no teacher/researcher observer UI" (~406–409), and the headline risk is PII (student work +
chat, persisted indefinitely, sent to OpenAI). Inheriting the teacher/researcher branches by copy is broader
than "owner-only."
**Suggested resolution:** make the teacher/researcher read branches a **deliberate decision**, not an inherited
copy — for the spike either (a) drop them so reads are strictly `isAuthed() && userOwnsDocument()`, or (b) keep
them and state that class teachers/researchers may read transcripts (which is a mild inconsistency with "no
observer UI" but enables evaluator inspection without emulator access). Note this also nuances the Pass-2/3
"owner-only read" acceptance criterion.

**Decision**: **Agreed — option (a): strictly owner-only, no teacher/researcher read branch.** Consistent with
the students-only / no-observer-UI design; the spike is test-accounts-only and evaluators already inspect
transcripts via the Firestore console/emulator, so no PII read surface beyond the owner is opened. Removed the
teacher/researcher hedge from the Requirements "Strictly owner-only read" bullet and the Technical Notes "Read
rule" bullet.

---

#### RESOLVED: SEC-6 (NIT / clarification) — the "minted-custom-token" rules validation the spec calls primary currently lives in the **Node-16** `firebase-test/` suite, not the "modern `@firebase/rules-unit-testing@^4`" harness
The spec cites `functions-v2`'s "modern `@firebase/rules-unit-testing@^4`" as test tooling (~476) and names
"emulator tests with minted custom tokens" as the primary rules validation (~508–510). Verified: the
auth-context harness that already mints `studentAuth`/`teacherAuth`/`researcherAuth` with
`platform_user_id`/`user_type`/`class_hash` claims is `firebase-test/` on `"node":"16"` +
`@firebase/rules-unit-testing@^1.3.16` (`firebase-test/setup-rules-tests.ts:14-43`) — the ideal, already-wired
landing spot. The `functions-v2` tests drive the emulator via the **admin SDK** (`firebase-functions-test` +
`admin.firestore()`), which **bypasses rules**, so the modern harness would need new setup to do claim-based
rules testing.
**Suggested resolution:** point the rules-test note at the `firebase-test/` (Node 16) suite for auth-context
rules validation; reserve `functions-v2`'s harness for trigger/logic tests.

**Decision**: **Agreed.** Pointed the Testing-approach note at the `firebase-test/` (Node 16) suite for auth-context rules validation (it already mints student/teacher/researcher claim contexts), and noted `functions-v2`'s harness drives Firestore via the admin SDK (bypasses rules), so it's for trigger/logic tests, not rules.

---

### Frontend / React Integration Engineer

#### RESOLVED: FE-1 (MEDIUM) — `exportSectionsAsJson()` does **not** produce whole-problem (or curriculum-section) granularity; there is **no single `DocumentContentModel` for a whole problem**
The spec presents `exportAsJson()` / `exportSectionsAsJson()` as the two granularity choices for LEFT (~98–99,
~284–285) and "prefers whole-problem granularity." Verified: `ProblemModel.sections` is `types.array(SectionModel)`
(`problem.ts:17`) and **each** `SectionModel.content` is its own separate `DocumentContentModel` (`section.ts:89`)
— there is no single document representing a whole problem. Meanwhile `exportSectionsAsJson`
(`document-content.ts:233-259`) splits **one** document by its internal `row.isSectionHeader`/`sectionId` rows,
which is orthogonal to the Problem→Section curriculum structure the spec means. So "whole-problem" LEFT actually
requires **iterating `problemModel.sections[]` and calling `section.content?.exportAsJson()` per section**
(null-checking the `types.maybe`), then concatenating — not a single call to either method.
**Suggested resolution:** correct the Technical Note / Requirement to describe LEFT construction as "iterate
`ProblemModel.sections`, `exportAsJson()` each section's content (null-check `types.maybe`), concatenate"; stop
presenting `exportSectionsAsJson()` as a whole-problem option. (Directly tied to IC-1 below.)

**Decision**: **Agreed — resolved with IC-1 (option a, whole problem).** Corrected the Requirements LEFT bullet and the Technical Notes LEFT note to describe the real construction: iterate `problemModel.sections[]`, `exportAsJson()` each section's `content` (null-check `types.maybe`), concatenate; stopped presenting `exportSectionsAsJson()` as a whole-problem option (it splits one document by internal section-header rows).

---

#### RESOLVED: FE-2 (MEDIUM–LOW) — statically importing `documentSummarizerWithDrawings` into an eager `chat-tutor/` file would hoist the lazy Drawing plugin + `react-dom/server` into the **main `index` bundle**
The RIGHT bullet offers `documentSummarizerWithDrawings` for drawing SVGs (~106–113, ~300). Verified: the
Drawing plugin is deliberately code-split (`register-tile-types.ts:41`,
`import(/* webpackChunkName: "Drawing" */ …)`), but `documentSummarizerWithDrawings` **statically** imports
`src/plugins/drawing/components/drawing-object-manager` and `.../model/drawing-content`
(`ai-summarizer-with-drawings.ts:9-10`) plus `react-dom/server`. The header
(`clue-app-header.tsx`) lives in the main `index` webpack entry (`webpack.config.js:68`), whereas the existing
`WithDrawings` client precedent is in the **separate** `doc-editor` entry (`:70`) — so it does **not** show the
main bundle already carries this. An eager import from `chat-tutor/` would pull the Drawing chunk +
`react-dom/server` into `index`.
**Suggested resolution:** for the spike, either use plain `documentSummarizer` (no drawing SVGs) for RIGHT, or
`import()` the WithDrawings summarizer dynamically at send-time so it stays code-split. Note the trade-off in
the RIGHT bullet.

**Decision**: **Agreed — option (a): plain `documentSummarizer` for the spike (no drawings).** The drawings variant statically pulls the code-split Drawing plugin + `react-dom/server` into the main `index` bundle when imported eagerly from `chat-tutor/`. The tutor sees all non-drawing tile content; drawing SVGs are an accepted spike omission (a later tier can dynamic-`import()` the drawings variant at send-time). Updated the RIGHT requirement bullet and added an FE-2 bundling note to Technical Notes.

---

#### RESOLVED: FE-3 (NIT / favorable) — the Technical Note claim "the three existing call sites all use plain `documentSummarizer`" is stale; a **fourth**, client-side call uses `documentSummarizerWithDrawings`
Verified: `src/components/doc-editor/doc-editor-app.tsx:204` calls
`documentSummarizerWithDrawings(getSnapshot(document.content), {includeModel, minimal})` — a client-side call
from a top-level app component (not a tile). This actually **de-risks** the design (working precedent for
calling WithDrawings outside a mounted tile — it needs no mounted tile, refs, or live DOM; it renders via
`ReactDOMServer.renderToStaticMarkup`), but the spec's "three call sites … all use plain `documentSummarizer`"
(~300) is factually wrong, and its "call it with the live `document.content` node" is one of two in-repo idioms
(the other passes `getSnapshot(document.content)` — both work).
**Suggested resolution:** correct the call-site count/claim and note WithDrawings needs no mounted tile (subject
to the bundling caveat in FE-2).

**Decision**: **Agreed.** Corrected the RIGHT-serialization Technical Note: removed the stale "three call sites all use plain `documentSummarizer`" claim, named the fourth client-side call site (`doc-editor-app.tsx:204`, uses the drawings variant), and clarified WithDrawings needs no mounted tile/DOM (the "not available in Firebase functions" reason is its import graph — the FE-2 bundling concern).

---

### Senior Engineer — Internal Consistency

#### RESOLVED: IC-1 (MAJOR) — LEFT granularity: Resolved Q2 decides "section," the Requirements/Technical Notes prefer "whole problem"
Resolved Q2's Decision (~440–443) resolves LEFT to "**A — the current problem/curriculum section**," but the
Requirements (~101–102) and Technical Notes (~289) "**prefer whole-problem granularity**," and the Requirements
even names section-granularity's downside ("would only be captured at first message") as a reason to reject
what Q2 resolved to. The Self-Review at ~548–550 admits the gap but Q2 was never updated. A reviewer cannot tell
whether LEFT is one section or the whole multi-section problem — which changes payload size, staticness, and the
"installed once" correctness argument. (Compounded by FE-1: "whole problem" isn't a single serializable model.)
**Suggested resolution:** rewrite Q2's Decision to "A — the current **problem** (whole-problem granularity, built
by concatenating each section's `exportAsJson()`), not a single section," and make Q2's Context/Option-A wording
consistent. Pick one canonical term ("the current problem") throughout.

**Decision**: **Agreed — whole-problem granularity.** Rewrote Resolved Q2's Decision to "A — the current problem, at whole-problem granularity," reconciling it with the Requirements/Technical Notes; a single current section is rejected because LEFT is installed once (would capture only the first-message section). Serialization corrected per FE-1.

---

#### RESOLVED: IC-2 (MAJOR) — four references to `implementation.md`, which does not exist; the LEFT-install mechanism and latest-context-wins envelope are deferred into a nonexistent file
`implementation.md` is cited as the home for decisions at ~192, ~198/523, ~911, and ~1001, but the spec folder
contains only `requirements.md`. The deferred items are the exact mechanisms a reviewer needs to assess
feasibility: the **LEFT install mechanism** ("fresh developer/context message vs. re-install of the conversation
item," ~192), the **latest-context-wins envelope** shape/sequence/timestamp (~198, ~523 "a design constraint for
implementation.md" — no format specified anywhere), the 1st-gen trigger region/no-retry config (~911), and the
keyless-state + re-key-on-switch behavior (~1001). As written these read as "resolved elsewhere" when they are
unresolved and unwritten.
**Suggested resolution:** either create `implementation.md` with these four items, or (for the spike) inline at
least the LEFT-install mechanism and the latest-context-wins envelope shape into `requirements.md` and drop the
dangling `see implementation.md` citations.

**Decision**: **Agreed — option (a): inline now, no `implementation.md` for the spike.** Inlined the two load-bearing mechanisms into requirements.md: (1) **LEFT install mechanism** — install LEFT once as a persistent developer-role conversation item (REPORT-73's `installDeveloperPrompt` surface, not the OpenAI system-prompt field), flagged on the parent doc; (2) **latest-context-wins envelope** — a `CURRENT WORKSPACE — supersedes earlier summaries (seq=<n>, ts=<ISO>)` header + monotonic per-conversation seq. Repointed the 1st-gen region/no-retry pointer at the backend requirement bullet (already captures it); the keyless-state pointer is repointed under IC-5. No remaining `see implementation.md` dangling references.

---

#### RESOLVED: IC-3 (MAJOR) — the RIGHT recompute trigger contradicts itself within one bullet
Line ~108 says "on each `user` send the client generates a compact markdown summary via `documentSummarizer`,"
while ~110–111 says "recomputed **only when the document changes** (memoized) … not on every keystroke." The
three phrasings ("on each user send," "only when hash differs," "recompute only on document change") are
reconcilable in principle, but ~108's literal "on each user send the client generates" states per-send
generation, which the same bullet then forbids. (The Pass-3 finding at ~984 documents the un-memoized reality it
is trying to fix.)
**Suggested resolution:** reword ~108 to separate the two events: "The RIGHT summary is recomputed (memoized)
only when the workspace document changes. On each `user` send, the client compares the current summary's hash to
the last one sent this conversation and attaches it only if it differs."

**Decision**: **Agreed.** Reworded the RIGHT requirement bullet to separate the two events: the summary is recomputed (memoized) only when the workspace document changes; on each `user` send the client hashes the current summary and attaches it only if the hash differs from the last one sent. Removed the self-contradictory "on each user send the client generates."

---

#### RESOLVED: IC-4 (MINOR) — LEFT cost described as "one-time (not per-turn)" contradicts the spec's own Conversations-API billing model
The spec establishes (Pass-1 Firebase/Performance finding, ~722) that with `store:true` + Conversations state
**every** installed payload is reprocessed and **billed as input tokens on every turn**. But the LEFT
description sells its cost as one-time: "a one-time payload does not accumulate" (~100), "sent once, so it
neither accumulates nor goes stale" (~197), and especially ~290 which contradicts itself in one sentence —
"one-time (**not per-turn**) cost — though it still rides along in every subsequent turn's reprocessed
conversation." "Does not accumulate" (no new copies) is accurate; "one-time / not per-turn cost" is not.
**Suggested resolution:** reword to "LEFT is *sent* once (never accumulates additional copies), but like all
conversation content it is reprocessed and billed as input tokens every turn — so keep it reasonably small";
drop "one-time (not per-turn) cost."

**Decision**: **Agreed.** Fixed all LEFT cost wordings (Requirements LEFT bullet + Technical Notes LEFT note): LEFT is *sent once* (never accumulates additional copies) but, like all `store:true` conversation content, is reprocessed and billed as input tokens every turn — dropped "one-time (not per-turn) cost."

---

#### RESOLVED: IC-5 (MINOR) — keyless workspace-document state is unspecified: the launcher is shown but the conversation key (`primaryDocumentKey`) is `types.maybe`
The conversation is "keyed by document key" (~91) sourced from `primaryDocumentKey`, which is `types.maybe`
(so "the launcher must handle a **keyless** state," ~267–268). But the launcher's *visibility* gate is only
student + `chatTutor` param (~78, ~247) — it does **not** require an open workspace document. So a student can
open the tutor with no key and thus no conversation, and the spec never says what happens (the only place it
would live is deferred to the missing `implementation.md`, IC-2). The empty-state copy (~116) covers "no messages
yet," not "no document."
**Suggested resolution:** specify the keyless behavior in `requirements.md` — either add "a workspace document is
open (`primaryDocumentKey` defined)" to the launcher's visibility gate, or define a keyless UX (launcher visible,
drawer shows "Open a document to start," composer disabled).

**Decision**: **Agreed — option (a): gate the launcher on an open document.** Added "and a workspace document is open (`primaryDocumentKey` defined)" to the App-header launcher visibility gate, so there is no keyless conversation; the tutor is simply unavailable until the student opens their workspace document. Updated the "Sourcing the current workspace document key" Technical Note (launcher hidden while keyless; read during render so it appears/disappears and re-keys on switch/close) and repointed the last `implementation.md` pointer.

---

#### RESOLVED: IC-6 (MINOR) — core backend behaviors are asserted with no acceptance criterion, after a formal DoD was explicitly declined
The QA finding (~631–639) resolves "no separate formal DoD — the Requirements already enumerate the behaviors,"
but the Requirements describe send→reply round-trip, per-conversation lock serialization, and reload rehydration
as ported machinery (~164–173, ~186–192) with **no** pass/fail acceptance statement. Only the accessibility set
(~158–160) and the rules (owner-only read, ~341/380) got explicit testable acceptance labels; only the
send-context-on-change case has a named test (~357). So three central behaviors are asserted but not testable as
written.
**Suggested resolution:** since a DoD was declined, add one testable acceptance clause each to round-trip,
lock-serialization, and reload-rehydration (e.g. "two `user` docs written back-to-back to one conversation
produce exactly two `assistant` replies, in order, never interleaved").

**Decision**: **Not changed — option (b), by project-owner call.** Consistent with the twice-declined formal DoD (and the dismissed PM DoD section): the three behaviors (send→reply round-trip, per-conversation lock serialization, reload rehydration) are inherited from the verified REPORT-73 machinery and the Requirements enumerate them; no inline acceptance clauses added for the spike. (Noted as a known, accepted gap.)

---

#### RESOLVED: IC-7 (MINOR) — the mandated Escape mechanism is a no-op in the version the documented local-dev workflow uses; the skew is noted but not resolved with a directive
Close-on-Escape is required via the strategy's `escapeHandlers` (~152) against the installed `0.1.0-pre.1`
(~142, ~154), and the spec flags (~153–155, ~936–938) that the local working copy at `~/projects/accessibility-tools`
is the older `0.0.1-pre.1` "whose hook does not invoke `escapeHandlers` at all." It records the skew but gives no
instruction to reconcile it — an implementer on the linked local copy (per the memory/`yalc link` workflow) would
build against a version where a stated acceptance behavior silently won't fire.
**Suggested resolution:** add a directive: "Build/test against `0.1.0-pre.1` or later; if using a linked local
working copy, upgrade it to ≥`0.1.0-pre.1` first — Escape-to-close depends on `escapeHandlers`, a no-op in
`0.0.1-pre.1`."

**Decision**: **Agreed — folded into the A11Y version directive.** The drawer-focus bullet now says: build/test against the installed `0.1.0-pre.1` (or later); if using a linked local working copy (`yalc link`), upgrade it to ≥`0.1.0-pre.1` first, since the older `0.0.1-pre.1` hook never invokes `escapeHandlers` (Escape-to-close silently won't fire).

---

#### RESOLVED: IC-8 (NITS) — small stale wordings
- **~402 (Out of Scope):** "JSON context rides on `user` messages only" is stale from before the JSON/markdown
  split — RIGHT is now **markdown**. Reword to "context (LEFT JSON / RIGHT markdown) rides on `user` messages
  only," matching ~114.
- **~258–260:** the app-header note places the launcher in "the `.right` region of **both** the student header
  and `renderNonStudentHeader()`," but the launcher is students-only, making the non-student placement dead
  code. Clarify it is describing where `.right` exists, not where the launcher goes.

**Decision**: **Agreed.** Fixed both nits: Out-of-Scope "JSON context rides on `user` messages only" → "context (LEFT JSON / RIGHT markdown) rides on `user` messages only"; and the app-header note now clarifies the launcher is students-only (placed only in the student header's `.right`; the non-student header is named only to locate `.right`).

---

### Backend / Cloud-Functions (informational — no issues, folded as notes)

#### RESOLVED (informational): the `openai@4.64 → ^6` bump is provably LangChain-safe, and need not touch the Node engine
Verified: `@langchain/openai@0.6.7` depends on `openai@^5.12.1`; `^5` and `^6` are disjoint SemVer ranges so npm
**cannot dedupe** them — the nested `openai@5.12.2` under `@langchain/openai` survives any top-level bump (the
current tree already shows top-level 4.64.0 coexisting with nested 5.12.2). Additionally **no `functions-v2/src`
file imports the raw `openai` SDK** (only `@langchain/openai` does, via its nested pin), so the top-level bump
touches no existing runtime code. `openai@6.45.0` declares no `engines` field and is CommonJS, so there is **no**
Node-20 incompatibility — report-service's `node:"22"` is its own choice, not an `openai@6` floor; do not pair
the bump with a gratuitous Node-engine change. (No spec change required; recorded so the stated "verify the bump
doesn't break LangChain" prerequisite is known-satisfiable.)

---

## External Review — Pass 5 (2026-07-08)

An external LLM review of the requirements spec surfaced five findings, all **new** relative to Passes 1–4
and all verified against the actual code before acceptance. Every one was accepted; where an earlier
decision-log entry (SEC-1, IC-1/FE-1, IC-5) stated the now-superseded wording, the **live** Requirements /
Technical Notes above are the source of truth and these entries record why.

### Frontend / React Integration Engineer

#### RESOLVED: ER-1 (HIGH) — the conversation key omits problem/offering, so a workspace document reused across problems retains a stale installed-once LEFT
The spec keyed one conversation on `networkDocumentKey(uid, documentKey, network)` + user identity and
installs LEFT (the whole problem) **once**, resting on "LEFT is static within a conversation." Verified gap:
CLUE reuses some workspace documents — **personal documents and learning logs** — across problems/offerings
(they are not problem-bound), so a document-key-only conversation would rehydrate an old transcript that
still carries the *first* problem's installed-once LEFT; the tutor then reasons against a stale problem.
`problemPath` is readily available (`stores.problemPath`, `stores.ts:257`; `buildProblemPath`, `unit.ts:161`).
**Suggested resolution:** include problem/offering identity in the conversation key, or reinstall/version LEFT
when `problemPath` changes.

**Decision**: **Agreed — add `problemPath` to the conversation key (per project owner).** Cleaner than
version/re-install machinery: a new problem starts a fresh conversation for which the installed-once LEFT is
trivially static, and problem-bound documents (which key to exactly one `problemPath`) are unaffected. Updated
the Requirements "Per-document, per-problem conversation" bullet and the Technical Notes "Path / keying" bullet
(key on `networkDocumentKey` **+ `problemPath`**; carry `problemPath` as a doc field).

---

#### RESOLVED: ER-2 (MEDIUM) — concatenating per-section `exportAsJson()` output is invalid JSON
The IC-1/FE-1 fix described LEFT as "iterate `problemModel.sections[]`, call `section.content?.exportAsJson()`
per section, then **concatenate**." Verified: `exportAsJson()` returns a JSON **string** (built via
`StringBuilder`, `document-content.ts:141-231`), so concatenating several section strings yields invalid JSON
(`{…}{…}`).
**Suggested resolution:** define a structured payload —
`{ sections: [{ type, title, content: JSON.parse(section.content.exportAsJson()) }] }` — or state explicitly
that the payload is a delimited text envelope, not JSON.

**Decision**: **Agreed — structured wrapper.** LEFT is now built by `JSON.parse`-ing each section's
`exportAsJson()` string into `{ sections: [{ type, title, content }] }` (serialized once for the payload), not
by string concatenation. Updated the Requirements LEFT bullet, the Technical Notes LEFT serialization note, and
Resolved Q2. (Supersedes the "concatenate" wording in the IC-1 / FE-1 decision-log entries above.)

---

### Frontend / React Integration Engineer

#### RESOLVED: ER-3 (MEDIUM) — the launcher gates on the document *key*, but the RIGHT summary needs loaded *content*; `documentSummarizer(undefined)` throws
IC-5 gated launcher visibility on `persistentUI.problemWorkspace.primaryDocumentKey` being defined. Verified:
`PersistentUI` can restore a `primaryDocumentKey` before the `DocumentModel` is available, and
`DocumentModel.content` is **itself** `types.maybe` (`document.ts:69`); `documentSummarizer(undefined, {})`
**throws** ("Failed to parse content", `ai-summarizer.ts:89-94`). So a defined key does not guarantee a
summarizable document.
**Suggested resolution:** require `documents.getDocument(primaryDocumentKey)?.content` before enabling
send/summarization, or specify a loading/error state until content exists.

**Decision**: **Agreed.** The launcher/send gate now also requires loaded content
(`documents.getDocument(primaryDocumentKey)?.content`), not just a restored key; the header destructure gains
`documents`, and the check is read during render (observer) so it reacts. Updated the Requirements App-header
launcher bullet and the Technical Notes "Sourcing the current workspace document key" bullet (now three
constraints). Extends IC-5.

---

### Security Engineer

#### RESOLVED: ER-4 (HIGH) — the rule templates enforce owner-identity but not the students-only decision, so a teacher/researcher can fire the paid trigger directly
The students-only decision (Resolved Q1) was enforced **only** by the UI launcher's visibility; the proposed
create/read rules checked `isAuthed()` + owner only. Verified: `firestore.rules` already exposes
`request.auth.token.user_type` via `hasRole(role)` (`:31-32`) and the app model has `user.isStudent`
(`user.ts:162`). Since a client `kind:'user'` write fires the paid OpenAI trigger, the **rules** — not the
hidden launcher — are the real boundary; without a role check, a teacher/researcher could create their own
chat docs and burn spend despite the hidden launcher.
**Suggested resolution:** require `hasRole("student")` on chat parent create and user-message create; consider
whether reads should also require student role.

**Decision**: **Agreed — student gate on create *and* read (per project owner).** Added `hasRole("student")` to
the parent-create, message-create, and read rules (alongside the SEC-4 owner pin and SEC-5 owner-only read), so
students-only is a rules-enforced invariant rather than UI-only. Updated the Requirements "Owner pinned +
student-gated at create", "Strictly owner-only, students-only read", and "Field-whitelisted create" bullets;
the Technical Notes "Client-create template" (now four load-bearing checks) and "Read rule" bullets; the
rate/abuse note; and the Risks security-critical acceptance criteria.

---

#### RESOLVED: ER-5 (LOW–MEDIUM) — `kind:'log'` is still allowed though log-forwarding is out of scope
The create template ported REPORT-73's `kind == 'user' || kind == 'log'` value check, but log-forwarding /
live tile telemetry is explicitly deferred (Out of Scope). Verified: REPORT-73's trigger fires the paid OpenAI
call on **both** `user` and `log` writes, so allowing `kind:'log'` opens a second, unused client-write path to
the paid trigger for no functional benefit.
**Suggested resolution:** for the spike, allow only `kind: 'user'` unless log-forwarding is actually
implemented and tested.

**Decision**: **Agreed.** Dropped the `|| kind == 'log'` branch; the create value check is `kind == 'user'`
only for the spike (add `'log'` back only when log-forwarding is implemented and tested). Updated the
Requirements "Field-whitelisted create" bullet, the Technical Notes "Client-create template", and the Risks
acceptance criteria. (Supersedes the `kind == 'user' || … == 'log'` wording in the SEC-1 decision-log entry
above.)

---

## External Review — Pass 6 (2026-07-08)

A second external LLM review, focused on the security rules and the RIGHT-summary timing introduced by
Pass 5. Both findings verified against installed code before acceptance; both accepted. **Together they
correct the ER-4 rule wording** (which used `hasRole("student")` and a raw `platform_user_id` comparison).

### Security Engineer

#### RESOLVED: ER-6 (HIGH) — chat rules used app-level `"student"`, but the real portal Firebase claim is `"learner"`; owner comparison also omitted the `string()` cast
The ER-4 fix required `hasRole("student")` in the rules and compared
`request.auth.token.platform_user_id == resource.data.platform_user_id` (raw). Verified against installed code:
- **Role value:** the Firebase token students carry has **`user_type: "learner"`** — `portal-types.ts:104`
  (`PortalFirebaseJWTStudentClaims`, whose own comment says these claims are "available to firestore security
  rules under `request.auth.token`"); `auth.ts:268 case "learner":`, `portal.ts:177`, and `auth.test.ts:38,359,380`
  all confirm `"learner"`. The app model's `user.type === "student"` (`user.ts:162`) is a **client-side remap**
  the rules never see. **Nothing** in the codebase produces a `"student"` token value. So `hasRole("student")`
  would **deny every real student.**
- **Masking risk:** the shared `firebase-test` fixture is `studentAuth = { …, user_type: "student" }`
  (`setup-rules-tests.ts:14`, dating to a 2021 commit) — wrong vs. the real token, but **never exercised**
  because `firestore.rules:32` `hasRole` is only ever called with `"teacher"`/`"researcher"`. A new
  `hasRole("student")` rule would pass the emulator test (fixture = `"student"`) while denying production
  (token = `"learner"`).
- **String cast:** `platform_user_id` is **numeric** (`portal-types.ts:100`; fixture `studentIdNumeric = 1`), and
  **every** existing owner comparison casts it — `string(request.auth.token.platform_user_id) == …data.uid`
  (`firestore.rules:58,68,71,157,188,293,320,396,427,440`). The ER-4 raw `==` would fail on type mismatch.

**Suggested resolution:** define a chat helper `isStudentClaim()` = `hasRole("learner")`; compare owners with the
`string(...)` cast; update chat test fixtures to the real `"learner"` claim.

**Decision**: **Agreed (per project owner: option A + new-code-only test fixture).** (1) Rules use
`isStudentClaim()` = **`hasRole("learner")`**, not `"student"`. (2) The chat doc's owner is a **`uid`** string
field and the rules **reuse the global helpers `userIsRequestUser()` (create) / `userIsResourceUser()` (read)**
— which live outside `match /documents` (`firestore.rules:56-72`, in scope for a top-level collection) and
already `string(...)`-cast the claim — instead of a raw `platform_user_id` comparison. (3) Testing note added:
the **new** chat-rules tests define their own `user_type: "learner"` auth context; the existing (latently-wrong)
shared `studentAuth` fixture is **not** edited. Updated the Requirements security bullets (SEC-3 helper-scope,
owner-only read, owner-pinned create), the Technical Notes (Identity idiom, Path/keying owner field,
Client-create template, Read rule, rate/abuse), the Risks acceptance criteria, and the Testing-approach note.
**Supersedes the ER-4 `hasRole("student")` + raw `platform_user_id` wording** in the Pass-5 ER-4 entry and the
earlier SEC-4 narrative.

---

### Frontend / React Integration Engineer

#### RESOLVED: ER-7 (MEDIUM) — RIGHT recompute timing was internally unsatisfiable ("on document change, not on keystroke" — same event in CLUE)
Pass-3/IC-3 settled the RIGHT wording as "recomputed (memoized) only when the workspace document changes, not
on every keystroke." Verified: in CLUE a tile edit mutates MST `document.content` **on each keystroke**, so a
naive observer on `document.content` recomputes the full summary per character — "document change" and
"keystroke" are the **same event**, making the two clauses unsatisfiable together.
**Suggested resolution:** specify the real trigger — mark dirty on content-snapshot changes, debounce/lazy
recompute, compute at send.

**Decision**: **Agreed — dirty-flag + compute-on-send.** A cheap `onPatch`/reaction on `document.content` sets a
**boolean dirty flag only** (no serialize); the expensive `documentSummarizer` recompute happens **lazily at
send, only if dirty** (sends are user-initiated/infrequent), then the hash-compare gates the actual re-send.
This makes per-keystroke work a single boolean flip and bounds the full summarize to at most once per send.
Reworded the Requirements RIGHT bullet and the Technical Notes RIGHT cost note; removed the "document change vs.
keystroke" framing.

---

## External Review — Pass 7 (2026-07-08)

A third external LLM review, focused on the conversation-doc keying (ER-1/ER-8) and the parent/message
ownership rules (ER-6/ER-9). Both findings verified against installed code before acceptance; both accepted.

### Senior Engineer / Firebase

#### RESOLVED: ER-8 (HIGH) — `problemPath` must be `escapeKey()`-ed before use in the conversation doc id
ER-1 added `problemPath` to the conversation key. Verified: `problemPath` is slash-delimited
(`buildProblemPath` → `unitCode/inv/prob`, `shared/shared.ts:55-56`), and `/` is a Firestore path separator that
CLUE's own `escapeKey` (`shared/shared.ts:1-3`) replaces with `_`; `networkDocumentKey` (`:114-118`) escapes only
the doc key/network, not any appended `problemPath`. Combining the **raw** `problemPath` into a doc id would
inject path separators, splitting the single conversation doc into a nested path and breaking the
"delete one top-level collection" cleanup.
**Suggested resolution:** canonical id `networkDocumentKey(...) + "_" + escapeKey(problemPath)`, keep raw
`problemPath` as a field.

**Decision**: **Agreed.** Canonical conversation doc id is now
`networkDocumentKey(uid, documentKey, network) + "_" + escapeKey(problemPath)`, with the raw (unescaped)
`problemPath` kept as a queryable field. Updated the Requirements "Per-document, per-problem conversation" bullet
and the Technical Notes "Path / keying" bullet.

---

### Security Engineer

#### RESOLVED: ER-9 (HIGH) — parent/message ownership was internally inconsistent; owner `uid` must be on every doc (option A)
The rules intro still said REPORT's technique keeps "owner fields only on the parent," but ER-6 made create/read
reuse `userIsRequestUser()` / `userIsResourceUser()`, which check `uid` **on the doc being created/read**
(`firestore.rules:56-59,68-72`). Since the client `onSnapshot`-reads message docs — including server-written
`assistant` docs — directly, those helpers only pass if **every** message doc carries `uid`; "owner only on the
parent" contradicts that.
**Suggested resolution:** either duplicate `uid` on every message/assistant doc (and whitelist it), or keep owner
only on the parent and have message rules `get()` the parent.

**Decision**: **Agreed — option A (per project owner): owner `uid` on every doc.** Both the parent conversation
doc and every message doc (user + assistant) carry `uid`. Client `user`-messages set their own `uid` (pinned by
`userIsRequestUser()`); the **server stamps `uid` onto each `assistant` doc** (admin SDK, bypassing rules); `uid`
is added to the message create whitelist; reads use `userIsResourceUser() && isStudentClaim()` uniformly on
parent and message docs. Rejected alternative B (owner only on parent; message rules `get()` the parent) — it
adds a Firestore `get()` per message read/create, i.e. an extra read per rendered message under `onSnapshot`.
Added an explicit "Document shape — owner `uid` on every doc" requirement bullet (enumerating parent vs. message
fields), corrected the Security-rules intro (dropped "owner fields only on the parent"), and updated the
field-whitelisted-create (`uid` in whitelist) and owner-only-read (applies to parent + message docs, assistant
docs server-stamped) bullets.

---
