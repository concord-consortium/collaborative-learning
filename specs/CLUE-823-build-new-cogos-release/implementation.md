# Implementation Plan: Land the ForeverLearning (Ada) integration package in CLUE

**Jira**: https://concord-consortium.atlassian.net/browse/CLUE-823
**Requirements Spec**: [requirements.md](requirements.md)
**Status**: **In Development**

## Implementation Plan

The package's code lands as two commits that match its own split (the complete patch minus the ownership change, then the ownership change), followed by eight small commits for the fixes in requirements.md. No dependency or lockfile changes are needed: every package the patch imports is already in the root, `shared/` and `functions-v2/` lockfiles.

The package lives outside the repo. Every command below takes it from `$PKG`, the folder the ZIP was extracted to (`~/tmp/CLUE-823-package/zip` for this spec). Before applying, confirm the two patch files still match `PACKAGE_MANIFEST.json`:

```bash
sha256sum "$PKG"/CONCORD_INTEGRATION_WITH_OWNERSHIP.patch "$PKG"/OWNERSHIP_ONLY.patch
python3 -I -c "import json,sys;[print(f['sha256'],f['path']) for f in json.load(open(sys.argv[1]))['files'] if f['path'].endswith('.patch')]" "$PKG/PACKAGE_MANIFEST.json"
```

### Send task and tool context, reserve FL requests and add recovery

**Summary**: Everything in the package except conversation ownership: `activityContext` and `capabilityContext` on FL messages and in the packet (R1 to R3), the pending-request reservation and idempotent dispatch (R4), and the delivery states, recovery controls and recovery UI (R5). One commit because the pieces share `drain.ts`, `fl-provider.ts`, `firestore.rules` and `firestore-transport.ts`, and the package was tested as a unit; reviewers can read it beside the guide's "What the integration adds".

**How**: apply the complete patch, then reverse the ownership patch on top of it.

```bash
git apply --check "$PKG/CONCORD_INTEGRATION_WITH_OWNERSHIP.patch"
git apply "$PKG/CONCORD_INTEGRATION_WITH_OWNERSHIP.patch"
git apply -R "$PKG/OWNERSHIP_ONLY.patch"
git add -A
```

Verified in a throwaway worktree of master: both applies are clean, and the resulting tree passes `tsc --noEmit` (root and functions-v2), 306 chat-tutor and fl-packet jest tests, 129 functions-v2 `chat-*` tests and the 509 `firebase-test` rules tests.

**Files affected** (38): new `shared/chat-delivery.ts`, `shared/fl-packet/activity-context.ts`, `shared/fl-packet/capability-context.ts`, `functions-v2/src/chat/delivery-recovery.ts`, `fl-delivery-error.ts`, `turn-persistence.ts`, `src/components/chat-tutor/activity-context.ts`, `capability-context.ts`, `docs/fl-integration.md`, their tests and `functions-v2/test/chat-fl-durability-emulator.test.ts`, `chat-activity-rules.test.ts`; changed `firestore.rules`, `firestore.indexes.json`, the functions-v2 chat files, `shared/fl-packet/packet.ts`, `sse.ts`, `dataflow-tile.ts`, and the chat-tutor components listed in requirements.md.

**Estimated diff size**: ~1,930 lines added, ~170 removed. Over the usual 500-line guide; the alternative (splitting a vendor patch that was built and tested as one) would produce intermediate commits nobody tested.

**Commit**: `feat: send Ada task and tool context, recover failed turns [CLUE-823]`, with a body that names ForeverLearning's integration package of November 21, 2026 as the source.

**As built**: one test change on top of the patch. The `chat-sidebar.test.tsx` case "reads the live student section without rebuilding the transport..." mocked `persistentUI.tabs` as a plain `Map`, so a rebuild on a tab change could not happen and its title's claim was untested. The mock is now a MobX `observable.map`, the tab change runs in `act()`, and the case asserts the transport count is unchanged; reading the tab in the sidebar's render turns it red.

---

### Bind tutor conversations to their learner from the first message

**Summary**: The ownership change (R6): owner-bound conversation ids, server-only parent creation, owner, class and problem checks in rules and in the drain before lock and dispatch, and reuse of a matching existing conversation under its old id.

**How**:

```bash
git apply "$PKG/OWNERSHIP_ONLY.patch"
git checkout -- firebase-test/src/setup-rules-tests.ts   # drop the CLUE_RULES_TEST_PROJECT_ID harness
git add -A
```

Also delete, in this commit, the sentences in `docs/fl-integration.md`'s ownership section that tell readers to run the firebase-test suite with `CLUE_RULES_TEST_PROJECT_ID=demo-clue-ownership-regression`, so no commit documents a harness the tree does not have.

After the first step that file is identical to master (verified), so checking it out after this apply drops exactly the harness. No other code uses `CLUE_RULES_TEST_PROJECT_ID`.

**Files affected** (14): new `shared/chat-ownership.ts`, `shared/chat-ownership.test.ts`, `src/components/chat-tutor/firestore-ownership.test.ts`, `functions-v2/test/chat-ownership-rules.test.ts`, `chat-ownership-emulator.test.ts`; changed `firestore.rules`, `functions-v2/src/chat-tutor.ts`, `chat/drain.ts`, `src/components/chat-tutor/firestore-transport.ts`, `chat-sidebar.tsx`, `firebase-test/src/chat-tutor-rules.test.ts`, `functions-v2/test/chat-drain-emulator.test.ts`, `chat-activity-rules.test.ts`, `docs/fl-integration.md`.

**Estimated diff size**: ~545 added, ~70 removed.

**Commit**: `fix: bind Ada conversations to their learner from the start [CLUE-823]`

**As built**: the package's two "race" tests could not fail (the foreign write fails the prefix check in any order). `chat-ownership-emulator.test.ts` now races two first triggers that both pass the prefix check and differ in `problemPath`, and expects exactly one lock and the winner's owner fields (a non-transactional `acquireLock` turns it red); the rules-test case is renamed "rejects a foreign first message under another learner's owner prefix". The `conversationId` option comment in `firestore-transport.ts` names `ownedConversationId` instead of `conversationDocId`.

---

### Log recorded FL delivery failures as unavailable

**Summary**: R7a. With the package applied, `useChat` logs `AI_CHAT_UNAVAILABLE` only for an error with no `delivery`, and every FL failure carries one. Add an effect that logs it at most once per sent message (keyed on the delivery's `messageId`), with the state and code, when the failure follows a send made in this session. Key the package's timeout log the same way, since its `recoveryAttempt` re-arm would otherwise log a timeout per retry. Both events then stay rates over `AI_CHAT_MESSAGE_SENT`.

**Files affected**:
- `src/components/chat-tutor/use-chat.ts`: the failure effect below, placed before the "live transport folds" comment, and the timeout effect below in place of the package's.
- `src/components/chat-tutor/use-chat.test.ts`: the stub transport's `status` helper passes a delivery; the three tests below.

`recover` deliberately does not mark the session as having sent: a recovery click logs no `AI_CHAT_MESSAGE_SENT`, so a failure after a recovery click on a conversation that opened already failed is not counted.

```ts
  // Once per sent message (retries share its messageId), so this stays a rate over AI_CHAT_MESSAGE_SENT.
  const failure = delivery && status !== "generating" && delivery.state !== "closed" ? delivery : undefined;
  const failureMessageId = failure?.messageId;
  const failureState = failure?.state;
  const failureCode = failure?.code;
  const loggedFailureMessageRef = useRef<string>();
  useEffect(() => {
    if (failureMessageId && failureMessageId !== loggedFailureMessageRef.current &&
        logContext && sentThisSessionRef.current) {
      loggedFailureMessageRef.current = failureMessageId;
      Logger.log(LogEventName.AI_CHAT_UNAVAILABLE,
        { ...logContext, deliveryState: failureState, deliveryCode: failureCode });
    }
  }, [failureMessageId, failureState, failureCode, logContext]);

  // (timeout effect, replacing the package's)
  // Keyed on the delivery's source message so a recovery's re-armed deadline does not log again.
  const waitingForId = delivery?.messageId ?? newestTurnId;
  const loggedTimeoutRef = useRef<string>();
  useEffect(() => {
    setTimedOut(false);
    if (!waiting) return;
    const timer = setTimeout(() => {
      setTimedOut(true);
      if (logContext && sentThisSessionRef.current && waitingForId !== loggedTimeoutRef.current) {
        loggedTimeoutRef.current = waitingForId;
        Logger.log(LogEventName.AI_CHAT_TIMEOUT, logContext);
      }
    }, kReplyDeadlineMs);
    return () => clearTimeout(timer);
  }, [waiting, newestTurnId, waitingForId, logContext, recoveryAttempt]);
```

A turn's id is its Firestore doc id and a delivery's `messageId` is its source message's doc id, so the two keys agree for a first send and its recoveries.

Test changes (stub first, then the new block at the end of the file):

```ts
import { ChatDelivery } from "../../../shared/chat-delivery";
// in stubTransport():
  let emitStatus: (status: ChatStatus, delivery?: ChatDelivery) => void = () => undefined;
    status: (s: ChatStatus, d?: ChatDelivery) => act(() => { emitStatus(s, d); }),

describe("useChat delivery failure logging", () => {
  const logContext = { conversationId: "c1", documentKey: "d1" };
  const delivery = (id: string, state: ChatDelivery["state"], code = "HTTP_429", messageId = "m1"): ChatDelivery =>
    ({ id, messageId, state, code });
  const named = (event: LogEventName) => mockLog.mock.calls.filter(([name]) => name === event);
  const withRecover = () => {
    const t = stubTransport();
    t.transport.recover = jest.fn(async () => undefined);
    return t;
  };

  it("logs a recorded failure once, with its state and code", async () => {
    const t = stubTransport();
    const { result } = renderChat(t.transport, logContext);
    await act(async () => { await result.current.sendMessage("help"); });
    t.status("generating", delivery("p1", "unknown", "FL_REQUEST_PENDING"));
    t.status("error", delivery("f1", "retryable"));
    t.status("error", delivery("f1", "retryable"));
    t.status("generating", delivery("f1", "retryable"));
    t.status("error", delivery("f1", "retryable"));
    expect(named(LogEventName.AI_CHAT_UNAVAILABLE)).toEqual([[LogEventName.AI_CHAT_UNAVAILABLE,
      { ...logContext, deliveryState: "retryable", deliveryCode: "HTTP_429" }]]);
  });

  it("logs one unavailable event and one timeout per sent message, however many retries fail", async () => {
    const t = withRecover();
    const { result } = renderChat(t.transport, logContext);
    await act(async () => { await result.current.sendMessage("help"); });
    t.turns([userTurn("m1")]);
    for (const id of ["f1", "f2", "f3"]) {
      t.status("generating", delivery(`p-${id}`, "unknown", "FL_REQUEST_PENDING"));
      advance(kReplyDeadlineMs);
      t.status("error", delivery(id, "retryable"));
      t.turns([userTurn("m1"), { id: "delivery-m1", sender: "system", text: "Ada could not reply." }]);
      await act(async () => { await result.current.recover!("retry"); });
    }
    expect(named(LogEventName.AI_CHAT_MESSAGE_SENT)).toHaveLength(1);
    expect(named(LogEventName.AI_CHAT_UNAVAILABLE)).toHaveLength(1);
    expect(named(LogEventName.AI_CHAT_TIMEOUT)).toHaveLength(1);
  });

  it("does not log a closed session or a failure already present on open", async () => {
    const t = stubTransport();
    const { result } = renderChat(t.transport, logContext);
    t.status("error", delivery("old", "failed"));
    await act(async () => { await result.current.sendMessage("help"); });
    t.status("idle", delivery("c1", "closed", "FL_SESSION_CLOSED", "m2"));
    expect(named(LogEventName.AI_CHAT_UNAVAILABLE)).toHaveLength(0);
  });
});
```

Prototyped on the patched tree: `use-chat.test.ts`, `chat-recovery.test.tsx` and `chat-timeout.test.tsx` pass (30 tests), and `tsc` and `.eslintrc.build.js` are clean. Keying the unavailable log on the failure id, or dropping the timeout's message check, turns the second test red (three events each).

**Estimated diff size**: ~80 lines.

**Commit**: `fix: log Ada delivery failures once per sent message [CLUE-823]`

The second test pushes the delivery notice turn after each failure, as the transport does, so the newest turn is no longer the source message; without it, keying the timeout on `newestTurnId` alone stayed green.

---

### Let a turn that never reached FL be retried

**Summary**: Fix 9 in requirements.md. As delivered, any error before the reservation commits (a transient Firestore error while reserving, a missing tutor user id, a packet over the limit) is recorded as `blocked`, and `prepareRecovery` refuses retry and continue without a reservation, so the student is stuck although nothing was sent.

**Files affected**:
- `functions-v2/src/chat/delivery-recovery.ts`:

  ```ts
  const kNotDispatched = "FL_NOT_DISPATCHED";

  // in recordDeliveryFailure
  // With no reservation the request was never dispatched, so a retry can rebuild it safely.
  const failure = error instanceof FlDeliveryError ? error : reserved.exists ?
    new FlDeliveryError("unknown", "FL_DELIVERY_UNCONFIRMED") : new FlDeliveryError("retryable", kNotDispatched);

  // in prepareRecovery, replacing the receipt check
  const notDispatched = delivery.code === kNotDispatched && !saved.exists;
  if (data.action !== "new_session" && !notDispatched &&
      (!saved.exists || saved.get("failure.id") !== delivery.id)) {
    throw new Error("Recovery has no matching server-owned failure receipt");
  }
  ```

  `recoveryAction("retryable")` is `retry`, so continue stays unavailable for this code, and the browser shows "Retry saved message" with no client change.
- `functions-v2/test/chat-fl-durability-emulator.test.ts`: "lets a failure before any reservation be retried, and the retry dispatches once". A provider whose `readDocument` throws once fails the first drain with no FL call and no reservation, the parent carries `{state: "retryable", code: "FL_NOT_DISPATCHED"}`, and a retry control then dispatches exactly once, writes one assistant reply and clears `delivery`.

Prototyped on the patched tree: `tsc` is clean, the functions-v2 chat tests pass (157), and removing the `notDispatched` exemption turns the new test red.

**Estimated diff size**: ~45 lines.

**Commit**: `fix: let Ada retry a turn that never reached FL [CLUE-823]`

**As built**: the durability fixture's `readDocument` runs a one-shot `beforeNextRead` hook, which the new test sets to throw. Two more checks: "keeps a source message changed before its reservation blocked, without dispatch" (a provider wrapper edits the source message before `processTurn`; reordering the ternary to test the reservation first turns it red), and "persists before dispatch..." now asserts its plain-`Error` failure with a reservation is `unknown` / `FL_DELIVERY_UNCONFIRMED`.

---

### Keep the raw workspace out of the reservation

**Summary**: Fix 11 in requirements.md. The package reserves `parentUpdate.flContent` (the raw workspace) inside `snapshotJson`, where JSON escaping grows it by about a quarter, so workspaces over roughly 790 KB exceed `reserve()`'s 980,000-byte limit and every turn from them is blocked. The value never needs saving: it is the source message's immutable `rightContent`, or the parent's own copy.

**Files affected**:
- `functions-v2/src/chat/fl-provider.ts`: in `prepare`, drop `if (document?.raw) parentUpdate.flContent = document.raw;`. After the stream completes, replace `if (parentUpdate.flContent === parent.flContent) delete parentUpdate.flContent;` with:

  ```ts
      // Read again rather than reserved: the raw workspace can approach Firestore's document
      // limit, and it is derived from the immutable message or the parent's own copy.
      const current = await readDocument(parent, message);
      if (current?.raw && current.raw !== parent.flContent) parentUpdate.flContent = current.raw;
  ```

- `functions-v2/src/chat/delivery-recovery.ts`, the "continue" branch: `flContent` comes from `source.get("rightContent")` when it is a non-empty string, instead of `earned.flContent`.
- `functions-v2/test/chat-fl-durability-emulator.test.ts`: "reserves and answers a turn whose attached workspace is near the browser's limit", with a source message carrying an escape-heavy workspace of more than 880,000 bytes and a `readDocument` that prefers `rightContent` as the trigger's does; it expects one FL call, one reply, the parent's `flContent` equal to the workspace and no reservation left.

Prototyped on the patched tree: `tsc` is clean, the functions-v2 chat tests pass (157, with the new case), and putting the reserved `flContent` back turns the new case red with "exceeds the durable snapshot limit".

**Estimated diff size**: ~45 lines.

**Commit**: `fix: keep large workspaces out of Ada's saved requests [CLUE-823]`

**As built**: the fixture's `readDocument` itself prefers `rightContent`, as the trigger's does, rather than a separate one for the new case. "preserves terminal failure..." now gives its source message a workspace and asserts "continue" copies it to the parent's `flContent`; going back to `earned.flContent` turns it red.

---

### Retry a conversation lookup that failed when the drawer opened

**Summary**: Fix 12 in requirements.md. The package caches `resolveConversation`'s promise even when it rejects, and attaches the listeners only when that first lookup succeeds, so one failed read on open (a network blip) leaves every later send failing with the cached error and no listener attached until the drawer is reopened.

**Files affected**:
- `src/components/chat-tutor/firestore-transport.ts`:

  ```ts
  private subscriptionVersion = 0;
  // The current subscription's listener setup, kept until it attaches so that a later successful
  // resolution (from a send or a recovery) can attach it after a failed first lookup.
  private pendingListen?: () => void;

  // resolveConversation: the async IIFE gains
      })().catch(error => {
        // Not cached: a transient failure must not keep every later send and the listeners out.
        this.resolution = undefined;
        throw error;
      });

  // subscribe: listen() attaches once, and is registered before either path
    const listen = () => {
      if (version !== this.subscriptionVersion || this.pendingListen !== listen) return;
      this.pendingListen = undefined;
      // ...the package's two onSnapshot calls, unchanged
    };
    this.pendingListen = listen;
    if (this.opts.legacyConversationId) { /* unchanged */ } else { listen(); }

  private async resolveAndListen(): Promise<void> {
    await this.resolveConversation();
    this.pendingListen?.();
  }
  // sendUserMessage and recover call resolveAndListen() where they called resolveConversation()

  // dispose: also clears pendingListen
  ```

- `src/components/chat-tutor/firestore-ownership.test.ts`: "retries a lookup that failed on open, then attaches the listeners and sends". The legacy read fails as `unavailable` on open: status is `error` and nothing listens. After the read recovers, a send runs the lookup again, attaches both listeners once and writes to the legacy conversation, and a second send neither looks up again nor attaches twice.

Prototyped on the patched tree: all 185 chat-tutor tests pass (the package's "does not attach late listeners after disposal" among them), and `tsc` and `.eslintrc.build.js` are clean. Restoring the cached rejection, or dropping the late attach, turns the new test red. Registering `listen` only on the legacy path broke the non-legacy path (two `firestore-recovery` tests), which is why it is registered before either path.

**Estimated diff size**: ~40 lines.

**Commit**: `fix: retry Ada's conversation lookup after a failed open [CLUE-823]`

**As built**: a second case, "attaches the listeners once when a send's lookup finishes before the subscription's", covers the `this.pendingListen !== listen` guard (a send started before `subscribe` would otherwise attach a second pair of listeners), and a third, "retries a lookup that failed on open from a recovery...", covers the recovery path.

---

### Keep keyboard focus in the composer while a reply is pending

**Summary**: Fix 10. The package disables the input whenever a `delivery` is set, which includes the pending delivery of every ordinary FL turn, and a disabled focused input drops focus to `body`, outside the drawer's focus trap.

**Files affected**:
- `src/components/chat-tutor/chat.tsx`:

  ```tsx
  // input
  disabled={sending}
  readOnly={!!delivery}
  aria-disabled={delivery ? true : undefined}
  // Send button: unchanged, disabled={sending || !!delivery || !input.trim()}
  // onSubmit
  if (!text || sending || delivery) return;
  // recovery button onClick, first line: the button is about to be disabled, then unmounted
  inputRef.current?.focus();
  ```

- `src/components/chat-tutor/chat.scss`: `.chat-input` gains `&[aria-disabled="true"] { opacity: 0.5; cursor: default; }`, matching `.chat-send[disabled]`. The input has no disabled style of its own and relied on the browser's, which a `readOnly` input does not get, so a fenced input would otherwise look editable.
- `src/components/chat-tutor/chat-recovery.test.tsx`: the package's `expect(screen.getByRole("textbox")).toBeDisabled()` becomes `toHaveAttribute("readonly")` plus `toHaveAttribute("aria-disabled", "true")` and `not.toBeDisabled()`; add a case that focuses the input, rerenders with a pending delivery, and expects `document.activeElement` to still be the input and Enter not to call `sendMessage`; and a case that focuses "Retry saved message", clicks it, rerenders with `pending: true`, and expects the input to hold focus (jsdom moves focus to `body` when the focused button unmounts, so this one fails without the focus call).

The focus behavior itself was checked in headless Chrome during review round 4: a focused input that becomes `disabled` loses focus to `body`, and one that becomes `readOnly` keeps it. jsdom does not model that loss, so the unit test guards the attributes and the submit fence, not the browser's focus rule.

**Estimated diff size**: ~45 lines.

**Commit**: `fix: keep keyboard focus in Ada's composer during a reply [CLUE-823]`

---

### Tidy the integration: owner helper, comments, docs and lint

**Summary**: Fixes 3, 4, 5 and 7 in requirements.md. No behavior change; every suite from the earlier steps must still pass, with only the test edits this step lists.

**Files affected**:
- `shared/chat-ownership.ts`: export the owner field list and a `hasChatOwner` helper, and build `sameChatOwner` on them:

  ```ts
  export const kChatOwnerFields = ["uid", "context_id", "problemPath"] as const;

  export function hasChatOwner(fields: Record<string, unknown>): boolean {
    return kChatOwnerFields.every(field => typeof fields[field] === "string" && (fields[field] as string).length > 0);
  }

  export function sameChatOwner(parent: Record<string, unknown>, message: Record<string, unknown>): boolean {
    return hasChatOwner(parent) && kChatOwnerFields.every(field => parent[field] === message[field]);
  }
  ```

- `functions-v2/src/chat/drain.ts`: `kOwnerFields` becomes `kChatOwnerFields` from shared (one list for the drain, the rules-facing helper and the client); `sameChatOwner(parent, parent)` and `sameChatOwner(ownerFields, ownerFields)` become `hasChatOwner(parent)` and `hasChatOwner(ownerFields)`. Add one case to `shared/chat-ownership.test.ts` for `hasChatOwner` with a missing and an empty field.
- `firestore.rules`: in the chatTutor block, replace "reads trust resource.data.uid, which the create rules pin to the caller's token and the trigger stamps (admin SDK) on server-written docs." (two lines) with "reads trust resource.data.uid, which the message create rules pin to the caller's token and the trigger stamps (admin SDK) on every doc it writes; clients cannot write a parent."; drop "First conversations require the updated client." from the `canStartChat` comment; remove the extra leading space before `data.problemPath is string`.
- `functions-v2/src/chat/drain.ts`: rewrite the quarantine comment as "A message whose owner fields differ from the parent's is rejected before any provider or reservation sees it, and the cursor advances past it in the same transaction so it cannot trap the owner." and drop "historical" from the reservation comment below it.
- `src/components/chat-tutor/firestore-transport.ts`: the `onReadError` comment (four lines) becomes "Snapshot read errors are not tutor failures by default: permission-denied means the rules did not let this caller read the conversation (a non-learner claim, or a parent that is not theirs). Show it as idle rather than as a tutor outage; any other code is a real failure." 
- `functions-v2/src/chat/drain.ts`: the `kOwnerFields` comment says the list comes from `shared/chat-ownership.ts`, where the client and the drain share it.
- `functions-v2/src/chat-tutor.ts` (the catch around `processAndDrain`) and `functions-v2/src/chat/drain.ts` (the "Pathological drain length" comment): "status:"error" self-heals" stays true for OpenAI but not for FL, where a recorded `delivery` keeps the drain stopped until a recovery control. Add that qualification to both comments.
- `firebase-test/src/chat-tutor-rules.test.ts`, "rejects all client parent creation, including owner-pinned pre-claims": with parent `create` now `false`, every assertion but the owner-pinned pre-claim passes by construction (the old rule denied the teacher claim too). Keep only the pre-claim, and retitle the case "rejects client parent creation, even an owner-pinned pre-claim".
- `functions-v2/test/chat-drain-emulator.test.ts`: the "file-scoped: cleanup() deletes the Firebase app" comment names a helper the package removed; it now describes the `deleteApp` call in `afterAll`.
- Comments that still say clients write only `user` messages, now that they also write `recovery` controls: the self-trigger guard in `functions-v2/src/chat-tutor.ts` ("only user messages start/continue a turn") names both kinds and says a control starts a recovery once, on its create; the chatTutor block header in `firestore.rules` ("the client writes `user` docs into") becomes "`user` messages and `recovery` controls"; the `FirestoreTransport` class comment in `firestore-transport.ts` adds the recovery controls it writes and the delivery notices it renders.
- `firestore.rules`: "Five load-bearing checks" in `chatMessageCreate`'s comment becomes "Load-bearing checks", since the package adds the `problemPath` and context checks.
- `docs/unit-summary-consumers.md`: after the `conversationDocId` sentence, add "The Firestore id is that key wrapped in an owner prefix (`ownedConversationId` in `shared/chat-ownership.ts`); a conversation that already exists under the bare key is reused when its owner, class and problem match."
- `src/components/chat-tutor/chat.tsx`: the recovery `</button>}` already lines up with its `<button` for `react/jsx-closing-tag-location`; the button moves to its own line under `{action && recover &&`, with the label's nested ternary one branch per line, so the closing tag sits where a reader expects it.
- Lines over 120 characters (13, plus the `hasChatOwner` test's import; listed by `npx eslint -c .eslintrc.build.js` and `functions-v2` `npm run lint`) in `shared/chat-delivery.ts`, `chat.tsx`, `firestore-recovery.test.ts`, `drain.ts`, `fl-provider.ts`, `turn-persistence.ts` and three functions-v2 tests: wrap them.
- `functions-v2/test/chat-fl-durability-emulator.test.ts`: project id `demo-clue-item3` becomes `demo-clue-fl-durability`, and the `item3-` parent prefix becomes `durability-`.
- `docs/fl-integration.md`: rewrite as the contract reference for the next engineer. Keep the sections on ownership, the context fields (with the capability JSON example and its limits), durable requests, the delivery-state table and the checks. Remove the opening "local cumulative reference against upstream <hash>" line, the "Item 4" and `demo-clue-item3` references, the qualification-package wording (keeping one sentence that `schema-conformance.test.ts` needs FL's capabilities schema, `clue_context_packet_v2_capabilities_v1.schema.json`, to check the context fields), the "now fail" and "supersedes the earlier recommendation" narrative, and the closing deploy-timing paragraph (it lives in the PR's callout). Update the delivery-state table so `FL_NOT_DISPATCHED` (a failure before anything reached FL) maps to "Retry saved message". Add a "Clearing a delivery that needs support" section. It covers a `blocked` delivery, and also a `retryable` `FL_NOT_DISPATCHED` that fails the same way on every retry (an oversized packet or a missing tutor user id). First read `chatTutorPendingRequests/{sha256(source message path)}`. **If it does not exist**, nothing reached FL: no FL check is needed and `flTurn` must not change. **If it exists**, take the request id from its `snapshotJson` (`request.context.envelope.trace.request_id`) or the parent's `delivery.requestId`, ask FL whether that request was answered, and note the snapshot's `parentUpdate` if it parses. Then, in one admin batch: delete the parent's `delivery` and `error`; set `status: "idle"`; set `lastProcessedMessageId` and `lastProcessedCreatedAt` to the source message; when a reservation existed, set `flTurn` and `flTraceId` from its `parentUpdate` (or, if that is missing, `flTurn` to the parent's value plus one) and `flContent` from the source message's `rightContent` when it is a non-empty string, and delete the reservation; and merge `{resolved: true, resolution: "continued"}` into `messages/delivery-<messageId>`. This mirrors the "continue" transition in `prepareRecovery` (`delivery-recovery.ts`); advancing the turn after a dispatched request keeps the next request from reusing its `Idempotency-Key` (`<trace>-t<turn>`). One case is outside this procedure: a message with a reservation whose owner fields do not match its parent stops the drain with "Reserved message ownership mismatch" and records no delivery; it needs an engineer, since the reservation may represent FL work billed to another learner. Add a one-line pointer to it at the end of the "ForeverLearning tutor backend" section of `functions-v2/README.md`.

Before committing, run the comment audit from the global instructions over the staged diff and the commit's own additions.

**Estimated diff size**: ~200 lines, most of it the doc rewrite.

**Commit**: `refactor: tidy Ada owner checks, comments and docs [CLUE-823]`

**As built (final review)**: the `kOwnerFields` comment shrinks to one line above `kDrainOwnedParentFields`; the over-cap comment in `fl-provider.ts` describes the retry replaying the reserved request instead of the drain rebuilding it; four package comments that only disclaimed FL vocabulary are deleted (`shared/chat-delivery.ts`, `firestore.rules`, `activity-context.ts`) or say what the field is (`TurnResult.requestId` and `sessionClosed`); and the recovery and system-notice styles in `chat.scss` move inside the `.chat-tutor` block and use the palette variables, with their contrast added to the file's AA notes.

---

### Check the new context fields against FL's packet schema

**Summary**: Fix 8. The opt-in `shared/fl-packet/schema-conformance.test.ts` never builds a packet with `activity_context`, `capability_context` or a tile `outputConfig`. Add one case beside "accepts a fully assembled packet built from a document" that passes an `activityContext` and a literal `CapabilityContext` object (not `buildCapabilityContext`, which would pull browser plugin code into a `shared/` test) to `buildContextPacket`, and validates the packet. The tile `outputConfig` is left out: the schema leaves tile content open, so a case for it would check nothing. It skips in CI like its neighbors; run it with `FL_SCHEMA_DIR="$PKG/conformance-fixtures"` before the PR.

The case needs a schema that defines `capability_context`: FL's `clue_context_packet_v2_capabilities_v1.schema.json`, which the package ships byte-identical under the name the test reads, `conformance-fixtures/clue_context_packet_v2.schema.json`. A pre-capabilities v2 schema has `additionalProperties: false` at the top level and fails the case ("must NOT have additional properties: capability_context"). The test's header comment says so, and the `docs/fl-integration.md` rewrite (tidy step) keeps one line naming that schema in place of the qualification-package sentence it drops.

**Files affected**:
- `shared/fl-packet/schema-conformance.test.ts`: one `itIfSchema` case; the header comment names the capabilities schema.

**Estimated diff size**: ~30 lines.

**Commit**: `test: check Ada context fields against FL's packet schema [CLUE-823]`

**As built**: the activity context uses `lesson_id: "1.2"`, the only form `buildActivityContext` emits, and the three packet cases share one typed `packetEnvelope`.

---

### Run the functions-v2 suite when the Firestore rules change

**Summary**: R9. The ownership and activity rules tests live in `functions-v2/test/`, and `.github/workflows/functions-v2.yml` runs only on `functions-v2/**`, `shared/**` and its own path, so a rules-only PR would skip them.

**Files affected**:
- `.github/workflows/functions-v2.yml`: add `'firestore.rules'` to `on.push.paths`.
- `.claude/skills/releasing-clue/cutting.md`: the sentence listing the workflow's trigger paths adds `firestore.rules`.

**Estimated diff size**: 1 line.

**Commit**: `ci: run the functions-v2 tests when firestore.rules changes [CLUE-823]`

---

### PR description, deployment and acceptance (no commit)

**PR description**: start from `PROPOSED_PR_DESCRIPTION.md` for the summary only. Replace its callout with the `docs/deploy.md` format, one entry each for functions, rules and indexes, using the timings and reasons recorded in requirements.md ("What deploy timing"): indexes before, rules with, functions with. The checker accepts `:` or a hyphen as the separator, so the entries can avoid dashes:

```markdown
> [!IMPORTANT]
> **Deploy timing**
> - **functions: <timing>**: <reason>
> - **rules: <timing>**: <reason>
> - **indexes: <timing>**: <reason>
```

Run `npm run build` (the repo's standard 4 GB heap) on the PR head. Drop the package's "five local browser/Functions loopback requests" claim, which this PR did not repeat. Re-measure every number on the PR head after the last rebase: the browser/shared, functions-v2 and `firebase-test` counts, and the diff size. Before asking for review, write the description to a file and run `npx --prefix scripts tsx scripts/check-deploy-timing.ts --base origin/master --body-file <description.md>` (from `docs/deploy.md`); the `Deploy Timing` check runs the same code in CI. When the PR goes up, create the follow-up story for deleting a student's `chatTutor` and `chatTutorPendingRequests` data (requirements.md) through marvin.

**Deployment** (Doug, after merge, following the `releasing-clue` skill):

1. Confirm `functions-v2/.env.collaborative-learning-<project>` still holds `FL_BASE_URL`, `FL_SOLUTION_ID=concordclue`, `FL_CATALOG_COMMIT` and the `FL_PROTECTION_*` values; no change expected.
2. Staging: deploy indexes, then rules, Functions and the staging client together, and run the hosted acceptance pass as narrowed in requirements.md, with two real learner launches (`setting-up-portal-assignments` skill) in a unit with `chatTutorHighlights` enabled. Record the build, the Functions and rules versions, and any request or session ids.
3. Production: deploy `firestore.indexes.json` ahead of the release; at release, deploy rules and Functions with the client (both `with`) while no turn is generating, then reload open classroom tabs and run the short production check (rows 1, 3 and 5).
4. Rollback, if needed, follows requirements.md: a combination that keeps ownership and recovery, never master and never rules alone.

## Open Questions

### RESOLVED: Judgment call: land the package as one commit, two, or many?
**Options considered**:
- A) One commit for the whole patch
- B) Two commits along the package's own seam (complete minus ownership, then ownership), then the fixes
- C) Re-split by feature (context, delivery, recovery, ownership)

**Decision**: B. The reverse apply of `OWNERSHIP_ONLY.patch` is clean and the intermediate tree compiles and passes, so the split costs two commands and gives the security change its own reviewable commit. C would need hand-splitting four shared files into states nobody tested.

### RESOLVED: Judgment call: log FL failures under the existing event or a new one?
**Options considered**:
- A) `AI_CHAT_UNAVAILABLE` with `deliveryState` and `deliveryCode` added to the context
- B) A new `AI_CHAT_DELIVERY_FAILED` event

**Decision**: A. Existing reporting counts `AI_CHAT_UNAVAILABLE`; a new name would silently zero that count for FL. The extra context fields are additive.

### RESOLVED: Low confidence: does the owner helper refactor change behavior?
**Context**: `sameChatOwner(x, x)` is true exactly when all three fields are non-empty strings, which is `hasChatOwner(x)`. `sameChatOwner(parent, message)` keeps its result because it already required non-empty strings on the parent and equality on the message.
**Decision**: No behavior change; the full ownership suites are the check.

## Self-Review

Roles: Commit Reviewer, Test Writer, Operator, Security Engineer. Each finding was checked by running the step or the command it describes.

### Commit Reviewer

#### RESOLVED: Three commit subjects were over 72 characters
Shortened; all ten subjects now fit.

#### RESOLVED: Does the first commit stand alone?
Applying the complete patch and reversing `OWNERSHIP_ONLY.patch` compiles and passes every suite (306, 129 and 509 tests), and leaves `firebase-test/src/setup-rules-tests.ts` identical to master, so the second step's checkout drops only the harness.

### Test Writer

#### RESOLVED: Can the logging tests and the owner refactor be written against the existing harnesses?
Both were built on the patched tree: the two `use-chat` tests pass with the stub transport's extended `status` helper, and the `hasChatOwner` refactor leaves the 156 functions-v2 chat tests and the client ownership tests green.

### Operator

#### RESOLVED: The deploy-timing check's local invocation
`docs/deploy.md` documents it; the PR step runs it before review.

### Review round 4 (multi-role)

Roles: Senior Engineer, QA Engineer, Education Researcher, Security Engineer, DevOps Engineer, WCAG Accessibility Expert. Each finding was confirmed on master plus the complete patch, with throwaway tests that stayed out of the spec branch.

#### RESOLVED: The logging effect logged one failure twice
Keyed on effect dependencies, a failure that stays in place while the parent passes through "generating" (a stale control, or a recovery `prepareRecovery` refuses) logged again: error, generating, error on one id gave two events. The effect now remembers the last logged id; the first test covers the round trip and fails without the ref.

#### RESOLVED: Fix 8's case fails against a pre-capabilities schema
With `capability_context` removed from the package's schema, the new case fails on the top-level `additionalProperties: false`, and the doc rewrite was dropping the only sentence naming the capabilities schema. The test header and the doc now name it.

#### RESOLVED: More comments still say clients write only `user` messages
The trigger's self-trigger guard, the rules block header and the transport class comment; added to the tidy step.

### Review round 5 (multi-role)

Roles: Senior Engineer, Security Engineer, QA Engineer, Education Researcher, Student, WCAG Accessibility Expert. Each finding was confirmed on master plus the complete patch, with throwaway tests that stayed out of the spec branch.

#### RESOLVED: The fixes hold when built together
Fixes 6, 8, 9 and 10, the recovery-button focus call and the owner helper refactor, applied together on the patched tree: `tsc --noEmit` is clean (root and functions-v2), the 31 browser/shared files pass 330 tests with the package's fixtures as `FL_SCHEMA_DIR` and `FL_CAPTURE_DIR`, the 9 functions-v2 files pass 157, and `firebase-test` passes 509 with 2 skipped. The planned code adds no lint findings; the 13 `max-len` warnings are the package's. The support procedure, run as an admin batch in throwaway emulator tests, clears an idempotency conflict (reservation present) and a damaged reservation, and the next message then dispatches under a new request id (`-t2`) with no delivery left.

#### RESOLVED: A fenced input looks editable
`chat.scss` styles only `.chat-send[disabled]`; the input relied on the browser's disabled styling, which fix 10's `readOnly` input does not get. Added an `aria-disabled` style to the fix 10 step.

#### RESOLVED: A transient error opening the conversation wedges the tutor until the drawer is reopened
**Context**: `FirestoreTransport.resolveConversation` caches its promise, including a rejected one, and `subscribe` attaches its listeners only when that first resolution succeeds. A throwaway test against the `firestore-ownership.test.ts` harness failed the legacy `get` with `unavailable`, restored it, and sent again: the send still rejected with the cached error, no second read ran, and no listener was ever attached. Every open does this server read, and master's listeners recovered from a network blip on their own. Closing and reopening the drawer unmounts the sidebar and builds a new transport, which is the only way out.
**Options considered**:
- A) Clear the cached promise when it rejects, and attach the listeners when a later resolution (from a send or a recovery) succeeds. About 15 lines and one case in `firestore-ownership.test.ts`.
- B) Keep the package's behavior and change the error text to tell the student to close and reopen Ada.
- C) Accept it; reopening the drawer recovers.

**Recommendation**: A. The student sees "Please try again", and trying again cannot work under the package's behavior.

**Decision**: A (Doug took the recommendation). Fix 12, its own step above.
