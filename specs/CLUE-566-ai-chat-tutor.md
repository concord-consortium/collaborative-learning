# AI Chat Tutor Sidebar in CLUE (Spike)

**Jira**: https://concord-consortium.atlassian.net/browse/CLUE-566

**Status**: **Closed**

## Overview

A time-boxed spike that adds an opt-in AI chat tutor to CLUE, opened from a button in the app
header, that helps a student reason about the work in front of them. It ports the per-page AI chat
tutor built for the Activity Player (AP-118, frontend) and the report-service (REPORT-73, backend),
adapting both to CLUE's document model, identity model, and styling. The goal is to learn whether a
contextual, document-aware tutor is useful in CLUE — not to ship a production feature. It is off by
default (enabled by the `chatTutor` URL param), students-only, and intended for pilot/test data only
(no real student PII, pending a FERPA/PII + retention review).

A post-implementation follow-on added **per-unit authoring of tutor prompt overrides**: unit authors
can optionally replace and/or append to the server-side generic tutor prompt from the CLUE authoring
interface, testable with both uncommitted draft config (authoring preview) and committed config.

## Requirements

### Frontend — sidebar UI (ported from AP-118)

- App-header launcher button, shown only when the `chatTutor` URL param is on, the user is a
  student, and a workspace document is open **with its content loaded** (a restored
  `primaryDocumentKey` does not imply loaded content; `documentSummarizer(undefined)` throws).
- Right-edge drawer under a new `src/components/chat-tutor/` directory (distinct from CLUE's
  existing `src/components/chat/` comment panel), restyled to CLUE's design system with
  WCAG-AA-verified contrast. *(Post-implementation change: the drawer is inline, not overlaying —
  the workspace shrinks and the drawer sits beside it as a third column; open state lives on an
  observable `ui.showChatTutor` flag.)*
- Transport abstraction: the `ChatTransport` interface ports from AP; both concrete transports are
  CLUE rewrites — a backend-free `DebugTransport` (selected by `chatDebug`, echoes "what would be
  sent") and the live `FirestoreTransport`.
- One conversation per workspace document **per problem**: conversation doc id =
  `networkDocumentKey(uid, documentKey, network) + "_" + escapeKey(problemPath)`
  (+ a prompts-hash suffix when unit prompt overrides are authored — see below). The drawer header
  makes the scope legible (document title · problemPath).
- Accessibility bar: labeled composer, single `aria-live="polite"` completion region (prop-driven,
  rehydration-safe), AT-exposed typing indicator, per-turn sender attribution in the DOM, surfaced
  error row (never an infinite spinner), and drawer focus management via the accessibility
  package's `useFocusTrap` (config-gated, `enterTrap()` on every open, Escape via an
  `escapeHandlers` → `"handled"` handler that closes and restores focus to the launcher). The
  launcher is a plain Tab stop (the header's roving region is not functionally wired) and never
  uses `disabled` as its busy state.

### Two-panel context: LEFT installed once, RIGHT refreshed on change

- **LEFT** — the whole current problem, serialized as JSON by iterating
  `problem.sections[]`, `exportAsJson()`-ing each section's content, and assembling a structured
  `{ sections: [{ type, title, content }] }` wrapper (never string concatenation — each export is a
  JSON string). Attached to the first `user` message and installed **once** as a persistent
  developer-role OpenAI conversation item, flagged `problemInstalled` on the parent doc. Built from
  `stores.problem` only (never the Teacher Guide). The first send gates on sections being loaded;
  the server refuses to set the flag on an empty LEFT, and the flag-driven client attach makes the
  recovery real (a later send re-attaches LEFT while the flag is unset).
- **RIGHT** — a compact markdown summary of the student's workspace document via plain
  `documentSummarizer` (not the drawings variant, which would hoist the code-split Drawing plugin
  into the main bundle). Recompute strategy: a cheap dirty flag flipped by an `onPatch` reaction
  (a keystroke *is* a content mutation in CLUE), with the expensive summarize done lazily at send
  time only if dirty, then a hash compare gates the actual re-send. Each sent RIGHT is wrapped in a
  latest-context-wins envelope (`CURRENT WORKSPACE — supersedes all earlier workspace summaries
  (seq=<n>, ts=<ISO>)`) with a server-owned monotonic `seq`; the generic prompt trusts the highest
  seq.

### Backend — port of REPORT-73 into `functions-v2`

- 1st-gen `onWrite` Firestore trigger hosted via `firebase-functions/v1` (kept 1st-gen for the
  default no-retry policy; explicit region co-located with the Firestore DB). Lock/drain machinery
  ported near-verbatim: self-trigger guard, per-conversation compare-and-set lock with stale
  reclaim, ordered drain with a tie-safe `{createdAt, messageId}` cursor, crash-safe atomic commit
  of assistant doc + cursor. Uses modular `firebase-admin/firestore` imports (the emulator's module
  proxy drops the `admin.firestore.*` namespace statics).
- Context assembly is net-new CLUE code: it reads the client-written `leftContext`/`rightContext`
  (and prompt-override fields) off the `user` message doc — the server never fetches curriculum.
- OpenAI Responses + Conversations API with a strict `json_schema` reply (required bumping
  `functions-v2` `openai` `^4.64` → `^6.x`; proven LangChain-safe). Key via
  `defineSecret("OPENAI_API_KEY")`, model via `defineString("OPENAI_MODEL")`.
- Server-owned generic tutor prompt (`CHAT_GENERIC_PROMPT`): tutoring stance, never-reveal-answers
  rule, science crosscutting-concepts lens, CLUE tile-awareness block, highest-`seq` rule, and a
  context-is-data-not-instructions injection-hygiene clause.

### Security rules (net-new, carefully reviewed)

- A self-contained **top-level** collection under each root (`{root}/{rootId}/chatTutor/...`) so
  the spike's data can be deleted wholesale.
- Owner `uid` on **every** doc (parent + messages; the server stamps assistant docs); reads are
  strictly owner-only **and** student-only (`userIsResourceUser() && hasRole("learner")` — the real
  Firebase claim is `"learner"`, not the client-side `"student"` remap; owner compares use the
  `string(platform_user_id)` cast).
- Field-whitelisted message create (`keys().hasOnly`) with an explicit `kind == 'user'` **value**
  check (that, not `hasOnly`, blocks a forged `kind:'assistant'`), a `createdAt`
  presence/orderable-type guard, the owner pin (`userIsRequestUser()`), the learner-claim gate
  (students-only is rules-enforced, or a teacher/researcher could fire the paid trigger directly),
  `context_id` pinned to the token's `class_hash`, and an `ownsConversation()` pin so a learner
  can't write into a classmate's conversation. Parent create rule is defensive only (the parent is
  created server-side by `acquireLock`).
- Demo (anonymous-auth) root: shape-only rules (field whitelist + `kind:'user'`), carved out of the
  permissive demo catch-all.
- Client transport requirements bound by the rules: `createdAt` written as `serverTimestamp()`
  (a numeric value sorts before every Timestamp and scrambles ordering), an owner-filtered
  `onSnapshot` (`where uid ==` — an unfiltered listen is denied), a `(uid, createdAt)` composite
  index (deploy-verified only; the emulator doesn't enforce indexes), and benign handling of
  `permission-denied` before the parent doc exists.

### Per-unit prompt authoring (follow-on, 2026-07-09)

- Unit config field `chatTutorPrompts?: { replaceGenericPrompt?, appendToGenericPrompt? }`,
  editable on a dedicated "Chat Tutor" page in the authoring app (trims on save; both blank deletes
  the key).
- The prompts ride the unit config to the client and onto install-eligible chat messages as
  `promptReplace`/`promptAppend` fields (the same pattern as `leftContext` — the server never
  fetches config). The function composes the effective generic prompt: non-empty replace swaps the
  built-in text, non-empty append is added after it; non-string/whitespace values ignored.
- A hash of the effective prompts is mixed into the conversation doc id (`_p<hash>` suffix) so a
  prompt edit starts a fresh conversation (the generic prompt installs once per OpenAI conversation
  and its items are immutable). No suffix when no prompts are authored — pre-existing conversation
  ids are unchanged.
- Draft/committed testing comes free from the authoring pipeline: preview tabs load draft
  `content.json` via the authoring API `/rawContent` (RTDB updates → blob cache → GitHub), so
  uncommitted prompt edits flow through on save + reload; committed values flow via the normal unit
  load.
- Both Firestore rules whitelists (authed + demo) admit the two fields with `is string` guards.
- Verified end-to-end in the browser (2026-07-09): draft round-trip, empty-key hygiene, append
  path, replace path (ALL-CAPS test), and fresh-conversation-on-edit all confirmed against the
  emulators.

### Gating

- Off by default; `chatTutor` boolean URL param (renamed from AP's `chat` to avoid colliding with
  CLUE's existing chat panel), `chatDebug` selects the debug transport. No persistence; no unit
  config gating for the spike.

## Technical Notes

- Sources: AP-118 (`activity-player`, chat sidebar frontend) and REPORT-73 (`report-service`, chat
  tutor backend); both spec'd in their own repos.
- Firestore doc shapes — parent: server-owned `{conversationId, status, lock, drain cursor,
  problemInstalled, seq}` + `{uid, context_id, problemPath}` stamped off the first triggering
  message (`pickOwnerFields`); message: `{uid, kind, createdAt, text, context_id, problemPath,
  leftContext?, rightContext?, promptReplace?, promptAppend?}`.
- The `/authed/**` rules only take effect in `appMode=authed`; they are validated by the
  `firebase-test/` emulator suite with a fresh `user_type: "learner"` auth fixture (the shared
  `studentAuth` fixture carries the wrong `"student"` value and is deliberately not reused) plus a
  real portal launch — never by `?appMode=qa` (anonymous → permissive subtree).
- The rules suite requires a **firestore-only** emulator: a full dev emulator stack with functions
  loaded fires the real trigger on test writes and corrupts suite state mid-run.
- Functions emulator gotchas: it serves compiled `lib/` (rebuild `functions-v2` after source
  edits), and chat preview URLs need `firestore=emulator` (separate from `firebase=emulator`).
- RIGHT is untrusted student prose injected at `developer` authority (TRUST-1) — same tier as the
  never-reveal rule; the context-is-data clause is best-effort. Same trust tier accepted for the
  client-supplied prompt-override fields. Revisit (e.g. send RIGHT at `user` role) before any
  real-student pilot.
- Deployment ordering for the prompt-override fields: rules (widened whitelists) → composite index
  → functions → client. `hasOnly` denies messages carrying the new fields under old rules.

## Out of Scope

- AP's server-side activity fetch / LARA convert / URL-keyed sim prompts (CLUE has nothing to
  fetch).
- Tool-calling / on-demand context retrieval; streaming (the trigger writes complete messages).
- Log-forwarding / live tile-edit telemetry (`kind:'log'` deliberately dropped from rules and
  drain).
- Placing the button in the existing comments/Discussions UI (superseded by the header launcher).
- Teacher/researcher observer UI — transcripts reviewed via Firestore console/emulator only.
- Production hardening: real rate limiting / per-user quotas beyond the hard OpenAI spend cap;
  formal FERPA/PII + retention review.
- Mobile / narrow-viewport layout.

## Not Yet Implemented

- **Deployment preconditions (operational gates, not code)**: hard spend cap on the OpenAI key;
  `OPENAI_API_KEY`/`OPENAI_MODEL` provisioned per environment; rules + `(uid, createdAt)` composite
  index deployed (staging was missing the index as of 2026-07-09); test accounts only.
- **Drawing SVGs in the RIGHT summary** — deferred; a later tier can dynamic-`import()` the
  drawings summarizer at send time to keep it code-split.
- **`userText:null` reply affordance** — a silent assistant reply clears the typing indicator but
  renders nothing; a neutral "no response" affordance is a named open UX choice.
- **Per-user rate limiting / create-only trigger semantics** — the real spend-abuse mitigations,
  named but deferred; the global cap bounds total spend, not per-student fairness.
- **RIGHT at `user` role** (TRUST-1 hardening) — deferred to a pre-pilot revisit.
- **Header arrow-key roving for the launcher** — owned by the separate CLUE keyboard-nav work; the
  launcher inherits it if that lands.
- **Warm-up ping** — skipped; cold-start latency accepted for the spike.

## Decisions

### Which users can open the tutor?
**Context**: AP restricted live chat to learners; CLUE has students, teachers, and researchers.
**Options considered**:
- A) Students only
- B) Students + teachers (preview/observe)
- C) An `enableCommentRoles`-style per-unit role list

**Decision**: **A — students only.** Matches the ported learner-only model and keeps identity/rules
simple. The launcher is student-only *and* the rules enforce the learner claim on create and read. A
role list can be added later if a pilot wants teacher preview.

---

### What counts as "the left panel" context document?
**Context**: The left resource panel can show the problem, another student's document, class work…
**Options considered**:
- A) The current problem (whole problem vs a single current section)
- B) Whatever document is currently displayed in the left panel
- C) Both

**Decision**: **A — the current problem, at whole-problem granularity.** The stable analog of AP's
authored page. A single "current section" would only capture wherever the student was at the first
message; the whole problem is unambiguously static for the conversation. Built by iterating
`problem.sections[]` into a structured JSON wrapper (there is no single `DocumentContentModel` for a
problem).

---

### Conversation persistence / history retention
**Options considered**:
- A) Persist per document indefinitely (reload rehydrates)
- B) Ephemeral per session

**Decision**: **A — persist indefinitely.** How the ported code behaves; better for a pilot
(inspectable transcripts, continuity). Refined by ER-1: keyed per document **and `problemPath`**, so
a reusable document (personal doc, learning log) gets a distinct conversation per problem rather
than one that outlives its installed-once LEFT. Later refined again by the prompt-authoring
follow-on: the authored-prompts hash is also part of the key, so a prompt edit starts a fresh
conversation (reverting to a prior prompt resumes that version's old conversation).

---

### Feature gate mechanism
**Options considered**:
- A) `UnitConfiguration` boolean surfaced through `AppConfigModel`
- B) A `chatTutor` URL query param, no config plumbing

**Decision**: **B — the `chatTutor` URL param.** A spike gate; per-unit config is a production
concern. (Renamed from AP's `?chat` to avoid the existing chat-panel collision.)

---

### Which functions codebase hosts the backend?
**Options considered**:
- A) `functions-v1` (1st-gen home, but EOL Node 16, no triggers/secrets/OpenAI precedent)
- B) `functions-v2`, hosting the 1st-gen trigger via `firebase-functions/v1`

**Decision**: **B.** Empirically verified `firebase-functions@5.1.1` re-exports the v1
trigger/`runWith` surface, so REPORT-73's trigger ports nearly verbatim while inheriting Node 20,
the existing `defineSecret`/OpenAI patterns, and modern test tooling. Kept 1st-gen deliberately —
2nd-gen at-least-once semantics would reintroduce the infinite re-drain hazard.

---

### Which Firebase project / deploy target?
**Options considered**:
- A) A CLUE dev/qa Firebase project + partition
- B) A dedicated throwaway project

**Decision**: **A.** The port needs CLUE's real rules/identity model to be meaningful. Important
sharpening: a dev/qa *project* is not a dev/qa *appMode* — the `/authed/**` rules are validated by
emulator tests with learner-claim contexts and a real portal launch, never by `?appMode=qa`.

---

### Step granularity (implementation)
**Decision**: One branch, ten commit-sized steps, single PR. The `DebugTransport` seam keeps the
frontend demoable within the branch; the rules step stays reviewable on its own.

---

### Generic tutor prompt — verbatim port or CLUE rewrite?
**Options considered**:
- A) Minimal edit (swap "page/activity" → "document/problem")
- B) Fuller rewrite tuned to CLUE tiles and the LEFT/RIGHT split

**Decision**: **B.** CLUE's "sims" are its tiles, so the report-service per-sim-fragment pattern is
the model: tool-as-investigation-tool, interface questions answered directly, Socratic guidance
reserved for the science reasoning. The four load-bearing pieces (tutoring stance,
never-reveal-answers, science lens, highest-`seq` rule) kept near-verbatim.

---

### Warm-up ping
**Decision**: Skip. The trigger is not a callable; a warm-up would mean a separate no-op callable
just for latency. Cold-start accepted for the spike.

---

### How do per-unit prompt overrides reach the server? (follow-on)
**Context**: The prompts are used server-side, but the function deliberately has no curriculum-fetch
path, and it has no way to know it should read a *draft* (it never sees `authoringBranch`).
**Options considered**:
- A) Client-carried: prompts ride the unit config to the client and onto the first chat message,
  like `leftContext`
- B) Server fetch: client sends unit URL/branch; server fetches config and replicates the
  draft-precedence logic

**Decision**: **A — client-carried.** Matches the established all-context-is-client-written
architecture, and draft testing works for free (preview tabs already load draft config through
`getContent`). Trust trade-off accepted: a student could forge the prompt fields, but that is the
same TRUST-1 tier as the existing `leftContext` injection surface. B is the natural hardening if
this graduates.

---

### How do prompt edits take effect, given the prompt installs once per conversation? (follow-on)
**Context**: OpenAI conversation items are immutable and `problemInstalled` is one-shot — an
existing conversation can never pick up a changed prompt.
**Options considered**:
- A) Hash the effective prompts into the conversation doc id — an edit maps to a fresh conversation
- B) Reuse one conversation doc; server detects a prompt change and swaps the OpenAI conversation
  underneath

**Decision**: **A.** Automatic (save → preview reload → new key → fresh conversation), keeps each
prompt revision's transcript clean for comparison, and no drain changes. No suffix when no prompts
are authored, so existing conversations are untouched. Accepted quirks: reverting to a prior prompt
resumes that version's old conversation; a djb2 collision between revisions is negligible at
authoring scale.

---

### Where do the prompt fields live in the authoring UI? (follow-on)
**Options considered**:
- A) A new dedicated "Chat Tutor" configuration page
- B) A section inside the existing AI Settings page

**Decision**: **A.** The AI Settings page's prompt fields are coupled to the document-evaluation
workflow (disabled unless `aiEvaluation === "custom"`, shared validation); the tutor prompts are
always-editable and a different feature. The replace field carries explicit warning copy — a full
replacement removes ALL built-in behavior (never-reveal, injection guard, highest-`seq` rule) —
mitigation is copy-only because the PI explicitly wants to test full replacement.

---

### Decisions from self-review passes (condensed)

Seven review passes (multi-role self-review, code-verified passes, and three external LLM reviews)
ran against the requirements, and three against the implementation plan. The significant resolutions:

**Architecture / cost**
- *Latest-context-wins envelope*: RIGHT summaries accumulate in the OpenAI conversation, so each is
  wrapped with a monotonic `seq` the prompt trusts — correctness fix for stale-document reasoning.
- *Cost accumulation redesign*: LEFT sent once (never re-accumulates) and RIGHT sent as compact
  markdown, structurally bounding per-turn cost; the spend cap is the backstop and tool-calling the
  deferred end-state.
- *Reuse honestly scoped*: lock/drain/trigger machinery ports near-verbatim; the entire
  context-composition half (fetch/convert/page-walk/sim-prompts) is deleted and replaced by
  CLUE context assembly.
- *`openai` SDK blocker*: `functions-v2` pinned `openai@^4.64`, which lacks
  `responses`/`conversations` entirely — the port required the `^6.x` bump, proven LangChain-safe
  (`^5`/`^6` can't dedupe; no src file imports the raw SDK) with two v6 fixups in
  `ai-categorize-document.ts`.
- *Modular `firebase-admin/firestore` imports*: the emulator's module proxy drops
  `admin.firestore.*` namespace statics (crashed at `serverTimestamp()`); modular imports work
  identically in production.

**Security rules** (each of these was a caught-and-fixed defect, not a nicety)
- `hasOnly` does **not** block a forged `kind:'assistant'` — the explicit `kind == 'user'` value
  check does (SEC-1); `kind:'log'` dropped since log-forwarding is out of scope and log writes fire
  the paid trigger (ER-5).
- The real student Firebase claim is `"learner"`, not `"student"` (a client-side remap the rules
  never see) — `hasRole("student")` would deny every real student while passing the emulator's
  latently-wrong shared fixture; new tests define a fresh learner fixture (ER-6).
- Students-only must be rules-enforced, not launcher-visibility-only, or a teacher/researcher could
  write a `user` doc directly and fire the paid trigger (ER-4).
- Owner `uid` on every doc (parent + assistant docs server-stamped) because the client
  `onSnapshot`-reads messages directly (ER-9); owner pinned at create via `userIsRequestUser()`
  (SEC-4); `context_id` pinned to the token's `class_hash` (COH-1).
- Top-level self-contained collection, deletable wholesale when the spike ends (SEC-3); strictly
  owner-only read with no teacher/researcher branch and never the `documents` rule's class-wide
  `resourceInUserClass()` (SEC-5); discrete leaf match so portal-level grants don't cascade (SE-4).
- `ownsConversation()` create pin added during implementation (SEC-7): without it a learner could
  write into a classmate's conversation and extract replies derived from the victim's private
  context. Accepted residual: pre-seeding a victim's conversation path is a denial, not an exposure.
- `createdAt` presence + orderable-type guard (SEC-2), with the transport required to write
  `serverTimestamp()` — a numeric `createdAt` sorts before every Timestamp and scrambles both the
  transcript and the drain cursor (CORR-1, emulator-verified).

**Client / reliability**
- Owner-filtered listen is mandatory (SE-1 — the read rule derefs `resource.data.uid`, so an
  unfiltered listen is denied) and needs the `(uid, createdAt)` composite index, which the emulator
  never exercises — deploy-verified only (IDX-1).
- `permission-denied` on the not-yet-created parent doc is the benign "no conversation yet" case
  (REL-1); "awaiting reply" computes off the raw assistant-doc stream so a `userText:null` silent
  reply can't spin the typing indicator forever (REL-2).
- `problemPath` must be `escapeKey()`-ed in the conversation id (`/` is a Firestore path separator)
  while the raw value stays a queryable field (ER-8).
- LEFT gates on sections actually loaded (`sections.length > 0`, **not** `isProblemLoaded`, which
  reads true while `loadSections` is in flight), and the client's LEFT attach is flag-driven
  (`!problemInstalled`) so the server's refusal to flag an empty LEFT has a real recovery path
  (FE-A/MST-1). LEFT is fed `stores.problem`, never the Teacher Guide (FE-B).
- RIGHT recompute is dirty-flag + compute-on-send — in CLUE a keystroke *is* a document change, so
  "recompute on change, not keystroke" was unsatisfiable as phrased (ER-7/IC-3).

**Accessibility** (verified against the installed `accessibility-tools@0.1.0-pre.1` dist)
- The header's roving-tabindex region is not functionally wired, so the launcher is a plain Tab
  stop for the spike — the earlier "auto-captured arrow stop" claim was overturned (A11Y-1).
- `useFocusTrap`'s `enabled` config is a no-op in the hook — gate by config presence
  (`useFocusTrap(undefined)` when closed) (Pass-3); `enterTrap()` must run on every open, mouse or
  keyboard, or controls stay `tabindex=-1` (A11Y-3); launcher restore must go through an
  `escapeHandlers` → `"handled"` handler because plain `onExit` is clobbered by the trap's
  unconditional `container.focus()` (A11Y-2); single `content` slot listed in `tabWithinSlots` so
  Tab walks the drawer's controls and Escape always finds the handler (A11Y-A/B); linked local
  package copies must be ≥`0.1.0-pre.1` or Escape silently won't fire (IC-7).
- The completion announcement is the `Chat` component's own prop-driven single polite region;
  transport-driven announcement wiring was dropped as a competing second announcer, and rehydration
  safety is inherent (aria-live ignores initial mount content) (A11Y-D).

**Process / testing**
- Parent conversation doc is created server-side by `acquireLock`; the client writes only message
  docs; the client parent-create rule is defensive (D-1).
- Trigger/drain behavior is manual/observational for the spike — the rules harness can't run
  triggers and the functions harness bypasses rules; automated coverage is the rules suite, the
  pure `decideContext`/context-assembly unit tests, and the promoted focus-trap contract test
  (D-3/QA-1..5). A formal DoD checklist was declined by the project owner (PM finding, IC-6).
- PII-to-OpenAI elevated to the headline risk: test accounts only; real-student piloting gated on
  the FERPA/PII + retention review.

## Verification (as implemented)

- Jest: client suites (chat-tutor modules, app-config, authoring page), `functions-v2`
  context-assembly suite, and the `firebase-test` chat rules suite (28 cases; firestore-only
  emulator, serial jest).
- Live emulator validation of the chat round-trip, lock behavior, and error path; browser
  (Playwright) validation of the authoring flow, draft preview, prompt append/replace, and
  fresh-conversation-on-edit (2026-07-09).
- Deployed-environment smoke test is the only check that exercises the composite index.
