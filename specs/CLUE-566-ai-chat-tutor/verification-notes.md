# CLUE-566 — Pre-implementation verification notes

**Jira**: https://concord-consortium.atlassian.net/browse/CLUE-566
**Requirements**: [requirements.md](requirements.md)
**Date**: 2026-07-08
**Purpose**: Record the throwaway checks run to confirm load-bearing assumptions in the
requirements spec **before** writing the implementation spec. Nothing here contradicted the
requirements; several claims the spec marks "verified against installed dist" are now also
confirmed by observed runtime behavior. The throwaway test files are deletable; this note is
the durable record.

Environment: CLUE working tree `CLUE-566-add-ai-chat`; installed
`@concord-consortium/accessibility-tools@0.1.0-pre.1`; `functions-v2` deps as installed
(`openai@4.64.0`, `firebase-functions@5.1.1`, `@langchain/openai` nested `openai@5.12.2`).

---

## A — `useFocusTrap` behavioral contract (A11Y-2 / A11Y-3)

**Why:** the drawer focus-management design (requirements "Drawer focus management via the
accessibility package") was derived by reading the **minified dist**. This check observes the
actual runtime behavior of the installed `0.1.0-pre.1` hook.

**How:** throwaway React Testing Library test (jsdom) mounting a minimal drawer
(launcher outside the trap; container with a body/content slot holding a composer + button)
that toggles `useFocusTrap(open ? config : undefined)`.
File: `src/clue566-focus-trap.throwaway.test.tsx` (4/4 passed).

| Claim (requirements) | Observed | Result |
|---|---|---|
| Config-gated: `useFocusTrap(undefined)` is dormant while closed | hook returns `null`, installs no listeners | ✓ |
| **A11Y-3**: mount runs `setChildrenNonTabbable()` | drawer button + composer get `tabindex="-1"` before `enterTrap()` | ✓ |
| **A11Y-3**: `enterTrap()` restores tabbability **and** focuses the composer | `tabindex` removed; `document.activeElement === composer` | ✓ |
| **A11Y-2 HAZARD**: plain `onExit` launcher-restore is clobbered | after Escape (no `escapeHandlers`), focus lands on the **container**, not the launcher, even though `onExit` called `launcher.focus()` | ✓ |
| **A11Y-2 WORKAROUND**: `escapeHandlers[slot]` → `"handled"` skips the trap's exit + `container.focus()` | drawer's own `launcher.focus()` stands; `document.activeElement === launcher` | ✓ |

**Implication for the impl spec:** the drawer's Escape/close MUST use an
`escapeHandlers[contentSlot]` handler that returns `"handled"` and performs close +
launcher-restore itself (or tear down by unmounting). Plain `onExit` is not usable for the
launcher round-trip. `enterTrap()` must run on **every** open (mouse or keyboard). Initial
focus on the composer is **strategy-driven** (`focusContent`), not automatic.

---

## B — LEFT / RIGHT serialization (ER-2, FE-1, ER-3)

**Why:** LEFT (problem→sections JSON) and RIGHT (workspace markdown) are the two net-new
serialization paths; ER-2 warns that concatenating per-section `exportAsJson()` output is
invalid JSON, and ER-3 that `documentSummarizer(undefined)` throws.

**How:** throwaway Jest test building a real `ProblemModel` with per-section tile content and
`await problem.loadSections("")` (so `problem.sections[]` holds real `DocumentContentModel`s),
plus the live `documentSummarizer`.
File: `src/clue566-serialization.throwaway.test.ts` (5/5 passed).

| Claim (requirements) | Observed | Result |
|---|---|---|
| `section.content?.exportAsJson()` returns a JSON **string** that parses on its own | `typeof === "string"`, `JSON.parse` OK per section | ✓ |
| **ER-2**: raw string-concatenating two section exports is **invalid JSON** | `JSON.parse(a + b)` throws | ✓ |
| **ER-2**: the structured wrapper `{ sections: [{ type, title, content: JSON.parse(...) }] }` is valid | `JSON.stringify` → `JSON.parse` round-trips; 2 sections | ✓ |
| **RIGHT**: `documentSummarizer` accepts a **live MST content node** → non-empty markdown | markdown contains the tile text | ✓ |
| **ER-3**: `documentSummarizer(undefined, {})` throws | throws `"Failed to parse content in aiSummarizer"` | ✓ |

**Implication for the impl spec:** LEFT builder MUST assemble the structured `{ sections: [...] }`
wrapper (parse each section, stringify once) — not string concatenation. RIGHT gate MUST require
loaded `content` before calling `documentSummarizer`. Call with the live `document.content` node
(matches `ai-tile.tsx:62`).

---

## C — Live store gating & keying (IC-5, ER-3, ER-1, ER-8)

**Why:** the launcher gating condition and the conversation doc-id keying were specified against
store shapes (`persistentUI.problemWorkspace.primaryDocumentKey`, `stores.problemPath`,
`documents.getDocument(key)?.content`, `networkDocumentKey` + `escapeKey(problemPath)`) that
needed confirming against a live session.

**How:** Playwright against the running dev server (`http://localhost:8080`), demo student
session — `?appMode=demo&fakeClass=1&fakeUser=student:1&unit=qa&problem=1.1&chatTutor`,
`localStorage.debug="stores document"`, joined Group 1 — reading `window.stores` directly.
(No throwaway file; live session only.)

| Claim (requirements) | Observed | Result |
|---|---|---|
| `stores.problemPath` / `persistentUI.problemPath` = `unitCode/inv/prob` | both `"qa/1/1"` | ✓ |
| Student user (launcher's students-only gate, app model) | `user.type === "student"`, `isStudent === true`, `id === "1"` | ✓ |
| `primaryDocumentKey` populated when a workspace doc is open | `-Ox0eScNEvtqecpC8FbA` (type `problem`) | ✓ |
| **Gating expression** `!!(key && documents.getDocument(key)?.content)` | `true` | ✓ |
| `content.exportAsJson()` on the real workspace doc parses | parseable JSON | ✓ |
| Reusable-across-problems doc type present (the `problemPath`-keying rationale, ER-1) | a `learningLog` doc also loaded | ✓ |
| **ER-8**: `networkDocumentKey(...) + "_" + escapeKey(problemPath)` yields a slash-free id | `uid:1_-Ox0eScNEvtqecpC8FbA_qa_1_1` (no `/`) | ✓ |
| **ER-8**: the **raw** `problemPath` variant injects `/` (the bug) | `uid:1_-Ox0eScNEvtqecpC8FbA_qa/1/1` (contains `/`) | ✓ |

**Two caveats to carry into the impl spec:**
1. **`network` is `null` in demo** (no portal network), so the id uses the `uid:<id>` prefix
   branch of `networkDocumentKey`. In `appMode=authed` there is a network → the id uses the
   `escapeKey(network)` prefix. The keying holds either way; read `user.network` at compose time,
   don't assume the `uid:` branch.
2. **The `"learner"` claim is not observable in demo.** `user.type` is the client-side remap
   `"student"` (ER-6); demo has no real Firebase token, so `hasRole("learner")` can only be
   validated in the **`firebase-test/` emulator suite** (where the spec already places it). C
   confirms the **app-model** student gate; the **rules-level** learner gate stays an emulator
   deliverable.

---

## D — `openai` SDK bump safety (Pass-3 BLOCKER, Pass-4 informational)

**Why:** the verbatim `openai.ts` port requires bumping `functions-v2` `openai` `^4.64 → ^6.x`;
the risk is breaking the existing LangChain path.

**How:** inspected the installed dependency tree.

| Claim (requirements) | Observed | Result |
|---|---|---|
| `functions-v2` `openai@4.64` lacks the Responses/Conversations API (bump is a hard prereq) | `client.responses === undefined`, `client.conversations === undefined` | ✓ |
| The bump is LangChain-safe | `@langchain/openai` (pinned `^5.12.1`) carries its **own nested** `openai@5.12.2`; `^5`/`^6` cannot npm-dedupe, so a top-level `^6` bump leaves it intact | ✓ |
| `firebase-functions@5.1.1` re-exports the 1st-gen v1 trigger surface | from inside `functions-v2`, `v1.firestore.document(...).onWrite` and `v1.runWith` resolve as functions | ✓ |

**Implication for the impl spec:** the bump is a mechanical prerequisite task (bump + typecheck),
not a claim needing re-verification. No `functions-v2/src` file imports the raw `openai` SDK, so
the top-level bump touches no existing runtime code.

---

## E — `createdAt` value-type ordering (CORR-1, Phase-3 re-review)

**Why:** the server writes assistant docs `createdAt: serverTimestamp()` (a Firestore **Timestamp**) and
both the drain cursor (`drain.ts:224`) and the client transcript order by `createdAt`. The SEC-2 create
rule permits `createdAt is timestamp || is int || is float`, so the load-bearing question is whether a
**numeric** client `createdAt` (rule-permitted, e.g. `Date.now()`) still interleaves chronologically with
the server's Timestamps, or whether Firestore value-**type** ordering dominates.

**How:** throwaway node script against the Firestore emulator (`firebase-admin@12`, admin context, rules
bypassed — pure ordering probe). Wrote two `serverTimestamp()` docs and two numeric docs (one `1000`, one
`1e16` — larger than any real epoch-ms), then `orderBy("createdAt").orderBy(__name__)`.
File: `scratchpad/clue566-createdat-order.js` (deletable; this note is the durable record).

| Claim | Observed | Result |
|---|---|---|
| Numbers and Timestamps interleave by chronological value | order was `num-tiny(1000)`, `num-huge(1e16)`, `ts-early`, `ts-late` — sequence **`NNTT`** | ✗ (refuted) |
| **CORR-1**: `orderBy("createdAt")` groups ALL numbers before ALL Timestamps regardless of magnitude | even `1e16` (≫ "now" ms) sorts **before** the "now" Timestamps | ✓ |

**Implication for the impl spec:** `FirestoreTransport` MUST write `createdAt` as a `serverTimestamp()`
Timestamp (matching the server) and read snapshots with `{ serverTimestamps: "estimate" }`. A numeric
`createdAt` would sort every `user` doc before every `assistant` doc in both the rendered transcript and
the drain cursor. The SEC-2 rule's `int||float` tolerance is defense-in-depth against a non-orderable
(`null`/string) `createdAt` wedging the drain — **not** license to write a number. (Applied to Step 5 +
Step 9 SEC-2.)

---

## F — `openai.ts` verbatim port vs a fresh `openai@^6` install (Step 6/7 prerequisite, third-pass review)

**Why:** Step 7 ports `openai.ts` verbatim after the Step-6 bump. Report-service verified against
`openai@6.45`, but the bump spec is `^6.x` — it resolves to whatever is latest at install time, so
the port's compile-safety against *that* version was unverified.

**How:** throwaway compile probe — fresh directory, `npm i openai@^6 typescript@5.9` (matching
`functions-v2`'s TypeScript), `report-service/functions/src/chat/openai.ts` copied unmodified,
`tsc --strict --noEmit`. Dir: `scratchpad/openai6-compile` (deletable; this note is the record).

| Claim (impl spec Step 6/7) | Observed | Result |
|---|---|---|
| `^6` resolves to a version with the Conversations + Responses API | resolved **6.45.0** exactly — the same version report-service verified end-to-end | ✓ |
| The verbatim `openai.ts` compiles after the bump | `tsc --strict --noEmit` exit 0 under TS 5.9 | ✓ |
| `openai@6` declares no `engines`, is CommonJS (Node-20-safe) | `engines: undefined`, `"type": "commonjs"` | ✓ |

**Implication for the impl spec:** the Step-6 bump + Step-7 verbatim port stand as written; no
version pin beyond `^6` is needed today. (Note: newer `openai` does not export `./package.json`,
so read the version via the filesystem, not `require`, in any tooling.)

---

## Throwaway artifacts — disposition (per impl-spec Self-Review QA-2 / QA-4)

- `src/clue566-focus-trap.throwaway.test.tsx` — check A. **Promote**, don't delete: move into
  `src/components/chat-tutor/` as a permanent regression test (the `useFocusTrap` contract is
  version-fragile against `0.1.0-pre.1`).
- `src/clue566-serialization.throwaway.test.ts` — check B. **Retire once its assertions are ported**:
  the LEFT-wrapper-validity (ER-2) and `documentSummarizer(undefined)`-throws (ER-3) assertions become
  the permanent `src/components/chat-tutor/left-context.test.ts` (impl-spec Tests step); the RIGHT
  send-gate is covered by `right-context.test.ts` (pure `decideContext`). Delete the throwaway only
  after those land, so no coverage is lost.
