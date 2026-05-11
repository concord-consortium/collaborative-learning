# Spec: Portal-Authenticated Class Summaries

**CLUE Repository**: https://github.com/concord-consortium/collaborative-learning

## Story Info/Status

Story: https://concord-consortium.atlassian.net/browse/CLUE-504
Status: *Hot fix deployed to production on 2026-04-18; repo sync (a6aeab287) and follow-ups complete*

## Overview

The Class Summary feature on the Sort Work tab ([CLUE-296](https://concord-consortium.atlassian.net/browse/CLUE-296)) was built and tested for demo classes only. A teacher-report link from `learn.concord.org` exposed two latent bugs that together prevented any portal-authenticated teacher from ever seeing a summary.

Both bugs were fixed live on the deployed environment so that a conference presentation could demo them. This document describes what was broken, what the hot fix changed, and what remaining work is needed to bring the repository back into sync with the deployed state and finish related improvements.

## The Original Bugs

### Bug 1 — Firestore rules gap for `aicontent`

`ai-summary.tsx` subscribes to `${firestoreRoot}/aicontent/${unit}/classes/${classHash}` via `onSnapshot`. In [firestore.rules](../../firestore.rules) there is no rule for `aicontent` under `match /authed/{portal}`, so the default deny rule at the top of the file applies.

Demo users were unaffected because `match /demo/{demoName}/{restOfPath=**}` allows any authenticated user to read/write. Portal-authenticated teachers got `FirebaseError: Missing or insufficient permissions`, and the UI showed `Error loading summary…` indefinitely.

### Bug 2 — `generateClassData_v2` routed authed requests into the wrong Firestore realm

Even after the rule was added, opening the summary produced an HTTP 500 from the cloud function. Logs showed:

```
Updating class data doc for clueful af6726d868103e03a4a58cac5ea7e0af5a05f128e65e19ff
Unhandled error TypeError: Cannot read properties of undefined (reading 'documents')
    at updateClassDataDoc       (.../update-class-data-docs.js:133:41)
    at updateSingleClassDataDoc (.../update-class-data-docs.js:155:11)
    at async /workspace/lib/functions-v2/src/generate-class-data.js:30:5
```

Inspecting the request payload:

```json
{
  "context": { "appMode": "authed", "portal": "learn.concord.org",
               "demoName": "ScottGroupDocTests", "classHash": "af6726…",
               "uid": "154964", "type": "teacher", ... },
  "portal": "learn.concord.org",
  "demo":   "ScottGroupDocTests",
  "unit":   "clueful"
}
```

Two observations:

1. The client sent **both** top-level `portal` and `demo`. The `demoName` came from `clue-demo-name` in `localStorage`, which is populated any time a user visits a demo URL and is never cleared when they subsequently authenticate through the portal. The value leaked from an earlier demo session.

2. `generate-class-data.ts` called `updateSingleClassDataDoc(portal, demo, unit, classHash, logger)`, which in turn called `firestoreBasePath(portal, demo)`:

   ```ts
   function firestoreBasePath(portal: string|undefined, demo: string|undefined): string {
     return demo
       ? `demo/${demo}`
       : `authed/${portal?.replace(/\./g, "_")}`;
   }
   ```

   When both are truthy, `demo` wins unconditionally. So the query ran against `demo/ScottGroupDocTests/documents` — which has zero docs for this class — rather than `authed/learn_concord_org/documents`, which is where the 52 real documents live. Zero rows returned, `classData[contextId]` was undefined, and `updateClassDataDoc` crashed dereferencing `data.documents`.

This is inconsistent with every other callable in the codebase (`postDocumentComment_v2`, `getAiContent_v2`, `createFirestoreMetadataDocument`, `postExemplarComment_v2`), which all ignore any client-provided `portal`/`demo` and derive the realm server-side from the validated `context.appMode` via [`getFirestoreRoot` in user-context.ts](../../functions-v2/src/user-context.ts).

## What Shipped as the Hot Fix

### Firestore rule (applied directly to the deployed ruleset, not yet committed)

```
match /aicontent/{unit}/classes/{classId} {
  // portal-authenticated teachers can read ai summaries for their own class
  allow read: if isAuthedTeacher() &&
    (request.auth.token.class_hash == classId || teacherIsInClass(classId));
  allow write: if false;  // only cloud functions write here
}
```

Added inside `match /authed/{portal}`. Writes are intentionally denied because the cloud function uses the admin SDK, which bypasses rules.

Note: deployed production rules were already missing the recent CLUE-397 comment-ratings rule changes, and deployed staging was also missing the `hasDocumentAccess()` consolidation on documents/comments. Any deploy brings those along.

### `generate-class-data.ts`

The callable now ignores the client's top-level `portal`/`demo` fields and derives them from the validated `userContext.appMode`. Deployed as version `1.0.1`:

```ts
const {context: userContext, unit} = params || {};

const validatedUserContext = validateUserContext(userContext, request.auth);
const {isValid, uid} = validatedUserContext;
const classHash = userContext?.classHash;
// Derive the realm from the validated user context rather than trusting the
// client-provided top-level `portal`/`demo` fields: a stale localStorage
// demoName can otherwise route an authed session into the wrong realm.
const portal = userContext?.appMode === "authed" ? userContext.portal : undefined;
const demo = userContext?.appMode === "demo" ? userContext.demoName : undefined;
if (!isValid || !classHash || !uid || !unit || (!portal && !demo)) {
  throw new HttpsError("invalid-argument", "The provided arguments are not valid.");
}

await updateSingleClassDataDoc(portal, demo, unit, classHash, logger);
```

The scheduled bulk path (`updateClassDataDocsForRealm` → hardcoded `portals`/`demos` lists) is untouched — it doesn't have a user context to derive from.

## Remaining Work

### 1. Commit the Firestore rule (completed: a6aeab287)

Add the `aicontent` rule block to [firestore.rules](../../firestore.rules) inside `match /authed/{portal}`. Deploying reconciles prod, staging, and master for this file.

### 2. Regression tests for `generateClassData_v2` (completed: 82ec09eb7)

There are currently **no tests** for the callable — the bug shipped uncaught because the only test file ([functions-v2/test/update-class-data-docs.test.ts](../../functions-v2/test/update-class-data-docs.test.ts)) covers the scheduled bulk path `updateClassDataDocs` and exercises only the demo realm.

Following the template of [post-document-comment-mocked.test.ts](../../functions-v2/test/post-document-comment-mocked.test.ts) + [post-document-comment-emulator.test.ts](../../functions-v2/test/post-document-comment-emulator.test.ts), add at minimum:

- A mocked or emulator test invoking `generateClassData` with `context.appMode === "authed"`, a valid portal, and a stray `context.demoName`. Assert the Firestore query that runs targets `authed/<portal>/documents`, not `demo/<demoName>/documents`.
- An emulator test for the demo case to ensure that path wasn't regressed.

### 3. Empty-query guard in `updateSingleClassDataDoc` (completed: 2f8622615)

Classes that legitimately have zero documents for a unit still crash with the same `TypeError`. The fix is in [shared/update-class-data-docs.ts](../../shared/update-class-data-docs.ts), around `updateSingleClassDataDoc` and `updateClassDataDoc`. When `classData[contextId]` is undefined, write a placeholder summary doc with `userCount: 0, documentCount: 0, studentContent: "", teacherContent: "", summary: null, summaryCreatedAt: <now>` so the client renders a clear empty state rather than spinning on "Generating summary…".

The client currently renders "No teacher summary available" / "No student summary available" when the respective strings are falsy; verify that path is reached, or add an explicit empty-state message.

### 4. Remove dead client-side fields (completed: 64a807a9f)

In [src/components/navigation/ai-summary.tsx](../../src/components/navigation/ai-summary.tsx) `summarize()` currently sends `{ context, portal, demo, unit }`. Since the server now ignores `portal` and `demo`, drop them — the callable payload becomes `{ context, unit }`, consistent with `getAiContent_v2` and other callables.

## Out of Scope / Related Concerns

- **`units` hardcoded list** in [shared/update-class-data-docs.ts:14](../../shared/update-class-data-docs.ts#L14) (`["qa-config-subtabs", "mods"]`) still limits the scheduled bulk pre-generation task. This story makes the on-demand path robust for any unit; it does not change the scheduled task's scope.

## Acceptance

- `firestore.rules` in master contains the `aicontent` rule, and prod + staging match master.
- Automated test covers the portal-authenticated path for `generateClassData_v2` (authed `context` + stray `demoName` → query targets `authed/<portal>/...`).
- Classes with zero documents for a unit produce a written placeholder summary doc and render a clear empty-state message in the UI.
- `ai-summary.tsx` no longer sends dead `portal`/`demo` fields.
- A portal-authenticated teacher opening the summary sees either a generated summary or a clear empty-state message — never "Error loading summary…" or indefinite "Generating summary…".
