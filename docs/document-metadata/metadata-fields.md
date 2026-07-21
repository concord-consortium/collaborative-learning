# Document Metadata Fields — Reference

> **Purpose:** a field-by-field account of every document metadata field: where it is stored, how it
> reaches the runtime, what updates it, and whether those updates reach the UI.
>
> **Related:** [document-types.md](../document-types.md) explains *where documents live and why* (RTDB
> paths, per-type layout). [firestore-schema.md](../firestore-schema.md) describes the Firestore
> collection structure. [firestore-sourcing-roadmap.md](./firestore-sourcing-roadmap.md) describes where
> this is all heading. This doc is the field-level companion to those three — when they disagree about a
> field, this doc is the one that was checked against the code.

## How to read this

The summary table is a scan view; the per-field sections below it are authoritative. Each field section
uses a fixed set of labels so a missing fact shows up as an absent label rather than silence:

- **Stores** — Firestore, RTDB, or both
- **Location** — exact path(s)
- **Applies to** — which document types carry it
- **Runtime** — where it surfaces in memory
- **Updated by** — what writes it after creation
- **Reactive** — whether a change reaches the UI without a reload, by what mechanism, and *for whose
  documents*

Paths use the conventions from [document-types.md](../document-types.md): `/{classPath}` is
`/{firebaseRoot}/classes/{classHash}`. Firestore paths are relative to `{root}/{space}/`.

**"Reactive" is about the reading client.** Nearly every field is reactive for the user who changed it,
because they mutated the model directly. The interesting question — and the one this column answers — is
whether *another* user sees the change.

## Summary

Grouped by the two classes in [the roadmap](./firestore-sourcing-roadmap.md#current-state-two-classes-of-metadata-field),
so this table doubles as a migration-progress view.

### Firestore-only

| Field | Stores | Applies to | Runtime | Reactive |
|---|---|---|---|---|
| `context_id` | Firestore | all | `DocumentModel.contextId`, `DocumentMetadataModel.context_id` | No — immutable |
| `network` | Firestore | all (null for students) | not surfaced | No |
| `tools` | Firestore | all editable | `DocumentMetadataModel.tools` | Yes, class-wide |
| `strategies` | Firestore | commented docs | `DocumentMetadataModel.strategies` | Yes, class-wide |
| `lastHistoryEntry` | Firestore | concurrent-history docs | not surfaced | No |
| `canonical` | Firestore | group | not surfaced | No |
| `offeringId` | Firestore + RTDB | problem family | not surfaced | No |

### Dual-stored (Firestore + RTDB)

| Field | Stores | Applies to | Runtime | Reactive |
|---|---|---|---|---|
| `title` | both | personal, learningLog, publications | `DocumentModel.title`, `DocumentMetadataModel.title` | **Own docs only** |
| `visibility` | both | problem, planning, personal, learningLog | `DocumentModel.visibility`, `DocumentMetadataModel.visibility` | Class-wide for problem; **see notes** for personal |
| `properties` | both | most | `DocumentModel.properties` | **No** |
| `groupId` | both | group, publication | `DocumentModel.groupId`, `DocumentMetadataModel.groupId` | Problem docs only, derived locally |
| `createdAt` | both | all | `DocumentModel.createdAt` | No |
| `uid` | both | all | `DocumentModel.uid` | No — immutable |
| `type` | both | all | `DocumentModel.type` | No — immutable |
| `key` | both | all | `DocumentModel.key` | No — immutable |
| `unit` | both | problem family | `DocumentModel.unit` | No |
| `investigation` | both | problem family | `DocumentModel.investigation` | No |
| `problem` | both | problem family | `DocumentModel.problem` | No |
| `originDoc` | both | publications | `DocumentModel.originDoc` | No |

### RTDB-only

| Field | Stores | Applies to | Runtime | Reactive |
|---|---|---|---|---|
| `content` | RTDB | all | `DocumentModel.content` | Yes — own + group |
| `changeCount` | RTDB | all editable | `DocumentModel.changeCount` | No — local counter |
| `lastHistoryEntryId` | RTDB | all editable | `DocumentModel.savedLastHistoryEntryId` (volatile) | No — read once |
| `pubVersion` | RTDB | publications | `DocumentModel.pubVersion` | No |
| `groupUserConnections` | RTDB | publication | `DocumentModel.groupUserConnections` — **never populated** | No |
| `lastEditedAt` | RTDB | all editable | not surfaced | No |
| `evaluation` | RTDB | analyzable docs | not surfaced | No |

---

## Firestore-only fields

### `context_id`

- **Stores:** Firestore only
- **Location:** `documents/{key}.context_id`
- **Applies to:** all document types
- **Runtime:** `DocumentModel.contextId` ([document.ts:81](../../src/models/document/document.ts#L81));
  `DocumentMetadataModel.context_id`
- **Updated by:** nothing — written once at creation from `self.classHash`
  ([db.ts:587](../../src/lib/db.ts#L587)) and enforced read-only by
  [firestore.rules](../../firestore.rules) `preservesReadOnlyDocumentFields`
- **Reactive:** No. Immutable, so there is nothing to react to.

The document's authoritative owning class. Note the case difference: Firestore stores snake_case
`context_id`; the model prop is camelCase `contextId`. It is read at `openDocument`
([db.ts:980](../../src/lib/db.ts#L980)) from the point-read Firestore metadata.

Also the query key for essentially every Firestore metadata read — both the `DocumentMetadataStore` point
read and the Sort Work watches filter on `where("context_id", "==", user.classHash)`.

A camelCase `contextId` field was written to Firestore historically and ignored; it was removed in
CLUE-524 and is not written today. [firestore-schema.md](../firestore-schema.md) still describes it as
"currently ignored" — that line is stale.

### `network`

- **Stores:** Firestore only
- **Location:** `documents/{key}.network`
- **Applies to:** all; `null` for student and group documents
- **Runtime:** not surfaced on any document model
- **Updated by:** nothing — written once at creation from `userContext.network`
  ([db.ts:588](../../src/lib/db.ts#L588))
- **Reactive:** No

Not a document property in any real sense — it records the creating user's single "primary" network name,
captured as a snapshot at document-creation time. [firestore.rules](../../firestore.rules) reads it back
(`resourceInTeacherNetworks`, `getDocumentNetwork`) to let teachers in the same network read and comment on
each other's documents, so teacher documents must keep writing it or that cross-teacher visibility silently
breaks. Student and group documents have no network, so the field is null for them. It is absent from
`IDocumentMetadata` and is bolted on via an intersection type at the write site.

Storing the network this way is not good. A teacher can belong to multiple networks or switch networks, so
a value frozen at creation time can later be wrong. The network association really belongs to the user (or
the class/offering), not to each individual document. This hasn't been reworked yet; until it is, new code
should be aware the field can be stale.

### `tools`

- **Stores:** Firestore only
- **Location:** `documents/{key}.tools`
- **Applies to:** all editable types
- **Runtime:** `DocumentMetadataModel.tools`. No `DocumentModel` prop — it is derived from content.
- **Updated by:** the content sync hook, which recomputes it from `content.tileTypes` (plus `"Sparrow"`
  when an arrow annotation exists) and calls `updateFirestoreDocumentProp("tools", tools)`
  ([use-document-sync-to-firebase.ts:298](../../src/hooks/use-document-sync-to-firebase.ts#L298))
- **Reactive:** Yes, class-wide, via the Sort Work `onSnapshot`.

Used to filter documents by the tile types they contain.

### `strategies`

- **Stores:** Firestore only
- **Location:** `documents/{key}.strategies`
- **Applies to:** documents that have been commented on with tags
- **Runtime:** `DocumentMetadataModel.strategies`
- **Updated by:** the `on-document-tagged` cloud function only
  ([functions-v2/src/on-document-tagged.ts](../../functions-v2/src/on-document-tagged.ts)) — the client
  never writes it
- **Reactive:** Yes, class-wide, via the Sort Work `onSnapshot`.

`DocumentMetadataStore` merges authored-exemplar strategies with the stored value when transforming a
snapshot, so the runtime value is a union rather than a straight read.

### `lastHistoryEntry`

- **Stores:** Firestore only
- **Location:** `documents/{key}.lastHistoryEntry` — `{ id, index }`
- **Applies to:** documents using the concurrent history manager
- **Runtime:** `DocumentMetadataModel.lastHistoryEntry`; not on `DocumentModel`
- **Updated by:** the concurrent history manager, inside its history-upload transaction
  ([firestore-history-manager-concurrent.ts:357](../../src/models/history/firestore-history-manager-concurrent.ts#L357))
- **Reactive:** No — read transactionally for fork detection, not observed by the UI.

Distinct from the RTDB `lastHistoryEntryId` (below). This one is the *head of the Firestore history
chain*; the RTDB one records which entry a given content snapshot corresponded to. They answer different
questions and are written by different code.

### `canonical`

- **Stores:** Firestore only
- **Location:** `documents/{key}.canonical`
- **Applies to:** group documents
- **Runtime:** not surfaced
- **Updated by:** the canonical-pointer transactions in `db.ts`
  ([db.ts:746](../../src/lib/db.ts#L746), [db.ts:766](../../src/lib/db.ts#L766))
- **Reactive:** No

Claims a canonical label for a group document so concurrent creators converge on one document. The rules
forbid setting it on create and permit a single one-time set on update. Not present in
`IDocumentMetadata` or `DocumentMetadataModel` — it has no type coverage at all.

### `offeringId`

- **Stores:** Firestore and RTDB
- **Location:** Firestore `documents/{key}.offeringId`; RTDB
  `/{classPath}/users/{uid}/documentMetadata/{key}/offeringId`
- **Applies to:** the problem family — problem, planning, publication, supportPublication, group
- **Runtime:** not surfaced on any document model
- **Updated by:** nothing — creation only
- **Reactive:** No

Listed here rather than under dual-stored because it is not in `IDocumentMetadata` and has no runtime
representation; it exists to scope documents to an offering. It reaches Firestore only because
`createFirestoreMetadataDocument` spreads the RTDB metadata object.

---

## Dual-stored fields

### `title`

- **Stores:** Firestore + RTDB
- **Location:**
  - Firestore `documents/{key}.title`
  - RTDB generic `/{classPath}/users/{uid}/documentMetadata/{key}/title`
  - RTDB type-specific `/{classPath}/users/{uid}/personalDocs/{key}/title` and
    `.../learningLogs/{key}/title` (`DBOtherDocument`), `/{classPath}/personalPublications/{pushKey}` and
    `/{classPath}/publications/{pushKey}` (`DBOtherPublication`)
- **Applies to:** personal, learningLog, personalPublication, learningLogPublication. Problem, planning
  and group documents have no stored title — theirs is generated from curriculum.
- **Runtime:** `DocumentModel.title`, `DocumentMetadataModel.title`
- **Updated by:** `setTitle` → `useSyncMstPropToFirebase` writes the **type-specific** RTDB record, with
  `updateFirestoreDocumentProp` mirroring to Firestore
  ([use-document-sync-to-firebase.ts:162](../../src/hooks/use-document-sync-to-firebase.ts#L162))
- **Reactive:** **Own documents only.**

This is the clearest example of the read-side asymmetry the roadmap describes, and worth spelling out
because the write side looks symmetric:

- The write path keeps *both* stores current.
- `DocumentMetadataModel.title` *is* updated live by the Sort Work `onSnapshot`, class-wide.
- But nothing renders it. The thumbnail caption comes from `useDocumentCaption(document)` →
  `DocumentModel.title`, which is RTDB-sourced.
- The only listener that calls `setTitle` is
  [db-other-docs-listener.ts:109](../../src/lib/db-listeners/db-other-docs-listener.ts#L109), subscribed
  to *your own* user node. The peer-document listener registers `child_added` only, so peer renames never
  arrive.

Net effect: if a peer renames a personal document while you have Sort Work open, the reactive value
updates in memory and the caption you see does not change. Making the caption read the metadata model is
roadmap step 3.

Separately, the generic `documentMetadata/{key}/title` written at creation is **never updated** — the
rename sync targets the type-specific record only. Nothing reads the generic copy, so this is latent
rather than user-visible.

### `visibility`

- **Stores:** Firestore + RTDB
- **Location:**
  - Firestore `documents/{key}.visibility`
  - RTDB generic `/{classPath}/users/{uid}/documentMetadata/{key}/visibility`
  - RTDB type-specific `/{classPath}/offerings/{offeringId}/users/{uid}/documents/{key}/visibility`
    (problem), `.../planning/{key}/visibility` (planning),
    `/{classPath}/users/{uid}/personalDocs|learningLogs/{key}/visibility` (`DBOtherDocument`)
- **Applies to:** problem, planning, personal, learningLog. Publications are implicitly public; group
  documents are group-scoped.
- **Runtime:** `DocumentModel.visibility`, `DocumentMetadataModel.visibility`
- **Updated by:** `setVisibility` / `toggleVisibility` → two separate sync hooks, one per type group
  ([use-document-sync-to-firebase.ts:132](../../src/hooks/use-document-sync-to-firebase.ts#L132) and
  [:147](../../src/hooks/use-document-sync-to-firebase.ts#L147)), both mirroring to Firestore
- **Reactive:** Class-wide for problem documents, via
  [db-problem-documents-listener.ts](../../src/lib/db-listeners/db-problem-documents-listener.ts)
  (`getOfferingUsersPath` — both teachers and students listen to all problem documents) →
  `updateDocumentFromProblemDocument` → `setVisibility`. Also class-wide from Firestore for the Sort Work
  thumbnails, which deliberately prefer the metadata value: see
  [document-utils.ts:105](../../src/models/document/document-utils.ts#L105) — *"It's prefered because
  it's reactive to remote changes."*

This is the one dual-stored field with a working reactive Firestore read today, which is why the roadmap
cites it as the model for moving the others.

**Personal and learning-log visibility does not round-trip.** The two sync hooks write different kinds of
path: the problem hook writes `typedMetadata`, but the personal/learningLog hook writes `metadata` — the
*generic* record. Meanwhile `createOtherDocument` writes `visibility` into the *type-specific*
`DBOtherDocument` ([db.ts:1081](../../src/lib/db.ts#L1081)), and `db-other-docs-listener` reads it back
from that same type-specific record
([db-other-docs-listener.ts:110](../../src/lib/db-listeners/db-other-docs-listener.ts#L110)). So a
visibility toggle on a personal document writes a location nothing reads, and the type-specific value
stays frozen at its creation default. The Firestore mirror *is* written, so Sort Work's thumbnail
accessibility check still sees the change; the RTDB copy is what goes stale. Flagged as an observation —
whether the generic path was deliberate is not determinable from the code.

**Planning documents never sync visibility at all.** They appear in none of the `enabled` lists, so their
`visibility` is frozen at the `"private"` set at creation
([db.ts:531](../../src/lib/db.ts#L531)).

### `properties`

- **Stores:** Firestore + RTDB
- **Location:** Firestore `documents/{key}.properties`; RTDB generic
  `/{classPath}/users/{uid}/documentMetadata/{key}/properties`; also on the type-specific
  `DBOtherDocument` and `DBOtherPublication` records at creation
- **Applies to:** problem, personal, learningLog, and the published types
- **Runtime:** `DocumentModel.properties` (MST map), `DocumentMetadataModel.properties`
- **Updated by:** `setProperty` / `setNumericProperty` → `useSyncMstNodeToFirebase`
  ([use-document-sync-to-firebase.ts:177](../../src/hooks/use-document-sync-to-firebase.ts#L177) and
  [:192](../../src/hooks/use-document-sync-to-firebase.ts#L192)) — **RTDB only**
- **Reactive:** **No.** No listener applies property changes to a document model. A peer marking a
  document deleted will not update in your session.

The free-form metadata bag: `isDeleted`, `pubCount`, `originTitle`, `isExemplar`, `authoredCommentTag`.

**The Firestore copy is written as `{}` at creation and never updated.** The creation payload sets
`properties: {}` *after* spreading the RTDB metadata, so any creation-time properties are discarded, and
the properties sync has no `additionalMutation`. So `documents/{key}.properties` is effectively always
empty from the client's perspective, even though `IDocumentMetadata` and `DocumentMetadataModel` both
declare it. Anything reading properties from the Firestore metadata should treat it as unpopulated.

### `groupId`

- **Stores:** Firestore + RTDB
- **Location:** Firestore `documents/{key}.groupId` (written only when truthy, so Firestore never sees
  `undefined`); RTDB `DBPublication.groupId`
- **Applies to:** group documents (the owning group) and publications (the author's group at publish
  time)
- **Runtime:** `DocumentModel.groupId`, `DocumentMetadataModel.groupId`
- **Updated by:** nothing writes it after creation. `setGroupId` exists but has no sync watcher.
- **Reactive:** Only for problem documents, and not from either store — `db-docs-content-listener` sets it
  inside a MobX `autorun` from the *local groups store*
  ([db-docs-content-listener.ts:65](../../src/lib/db-listeners/db-docs-content-listener.ts#L65)). So it
  tracks group membership changes rather than document changes.

`DocumentMetadataModel` documents the intent: for non-group documents this should be undefined, because
the document owner's group can change and stale group ids are worse than absent ones. Sort Work's
grouping reads the metadata model's `groupId`, so that path *is* reactive from Firestore.

### `createdAt`

- **Stores:** Firestore + RTDB
- **Location:** Firestore `documents/{key}.createdAt`; RTDB
  `/{classPath}/users/{uid}/documentMetadata/{key}/createdAt`
- **Applies to:** all
- **Runtime:** `DocumentModel.createdAt` (default `0`), `DocumentMetadataModel.createdAt`
- **Updated by:** nothing — creation only. RTDB uses the server timestamp sentinel, read back and
  resolved before the Firestore write. Read-only per the rules.
- **Reactive:** No. Local documents read it once from RTDB metadata at open. Remote documents fill it in
  later, when content is fetched ([document.ts:272](../../src/models/document/document.ts#L272)).

`openDocumentFromFirestoreMetadata` deliberately does *not* pass `createdAt` — see the note at
[db.ts:1034](../../src/lib/db.ts#L1034) ("not passed here because it hasn't been included in the past"),
so documents opened through that path keep the default `0`. Sort Work sorts on the metadata model's
value, not the document model's, so this does not affect sorting.

### `uid`, `type`, `key`

Grouped because they behave identically: written once, immutable, read-only in the rules, and the joint
identity of a document.

- **Stores:** Firestore + RTDB
- **Location:** Firestore `documents/{key}.{uid,type,key}`; RTDB generic metadata carries `type` and
  `self.uid` / `self.documentKey`
- **Applies to:** all
- **Runtime:** `DocumentModel.uid`, `.type`, `.key` — all required props with no setters.
  `DocumentMetadataModel.key` is the MST `identifier`.
- **Updated by:** nothing
- **Reactive:** No — immutable

`key` is also the document's `treeId` for the history system. For group documents `uid` is a synthetic
value derived from the group (`group_{offeringId}_{groupId}`) rather than a real user id.

### `unit`, `investigation`, `problem`

- **Stores:** Firestore + RTDB *(declared)*
- **Location:** Firestore `documents/{key}.{unit,investigation,problem}`; RTDB
  `DBBaseProblemDocumentMetadata` declares all three
- **Applies to:** the problem family. For personal and learning-log documents `unit` is explicitly written
  as `null`.
- **Runtime:** `DocumentModel.unit` / `.investigation` / `.problem`;
  `DocumentMetadataModel` likewise
- **Updated by:** nothing — creation only
- **Reactive:** No

At creation these come from the *current* unit/investigation/problem stores via `currentProblemInfo`
([db.ts:605](../../src/lib/db.ts#L605)), not from the document — so they record where the user was when
the document was made.

Two wrinkles worth knowing:

- **The RTDB copy is declared but never written.** `DBBaseProblemDocumentMetadata` includes all three,
  but `createDocument` writes only `classHash` and `offeringId`. The values reach Firestore only, via
  `currentProblemInfo`. The type overstates what is stored.
- **Provenance differs by open path.** `openDocumentFromFirestoreMetadata` takes them from the stored
  Firestore doc, while `openDocument` callers pass `currentProblemInfo`. `createDocumentModelFromOtherDocument`
  (personal, learningLog) passes none of them, leaving the props `undefined` even when Firestore has values.

The explicit `unit: null` for non-offering documents is load-bearing: Sort Work runs a second
`where("unit", "==", null)` listener to pick these up, because a `where("unit", "in", [...])` query would
skip them.

### `originDoc`

- **Stores:** Firestore + RTDB
- **Location:** Firestore `documents/{key}.originDoc`; RTDB `DBOtherPublication.originDoc`
- **Applies to:** publications. `DBPublication` (published problem documents) has no `originDoc` — the
  origin is inferred from `userId` and the offering.
- **Runtime:** `DocumentModel.originDoc`, `DocumentMetadataModel.originDoc`
- **Updated by:** nothing — set at publish
- **Reactive:** No

Key of the document this was published from. Used to group publication versions and to find the source.

---

## RTDB-only fields

### `content`

Not metadata, and listed only to mark the boundary: content stays in RTDB and is explicitly out of scope
for the Firestore sourcing work.

- **Stores:** RTDB only
- **Location:** `/{classPath}/users/{uid}/documents/{key}/content` — a JSON **string**, not a tree
- **Runtime:** `DocumentModel.content` (a `DocumentContentModel` tree)
- **Updated by:** the content sync `onSnapshot`
  ([use-document-sync-to-firebase.ts:308](../../src/hooks/use-document-sync-to-firebase.ts#L308))
- **Reactive:** Yes — `db-docs-content-listener` applies remote content to the model for the user's own
  documents and, for students, their group's problem documents; teachers monitor all problem documents.

### `changeCount`

- **Stores:** RTDB only
- **Location:** `/{classPath}/users/{uid}/documents/{key}/changeCount`
- **Applies to:** all editable types
- **Runtime:** `DocumentModel.changeCount`
- **Updated by:** `incChangeCount()`, called from *inside* the content-write transform rather than
  triggering a write of its own
- **Reactive:** No. The content listener receives `changeCount` in the payload and discards it, applying
  only `content`. Two clients viewing the same document will diverge in their counts.

### `lastHistoryEntryId`

- **Stores:** RTDB only
- **Location:** `/{classPath}/users/{uid}/documents/{key}/lastHistoryEntryId`
- **Applies to:** editable documents with history; omitted for fresh documents and pre-feature saves
- **Runtime:** `DocumentModel.savedLastHistoryEntryId` — **volatile**, not a persisted prop
- **Updated by:** written conditionally as part of the content-write transform
- **Reactive:** No — read exactly once at load time.

Records which history entry had been applied when a content snapshot was saved, so the history loader can
detect drift between RTDB content and the Firestore history chain. See `lastHistoryEntry` above for the
Firestore field with the confusingly similar name.

### `pubVersion`

- **Stores:** RTDB only
- **Location:** `DBPublication.pubVersion` and `DBOtherPublication.pubVersion` in the publication index
  records
- **Applies to:** publications
- **Runtime:** `DocumentModel.pubVersion` — no setter, creation-snapshot only
- **Updated by:** nothing — set at publish from the source document's `pubCount` property
- **Reactive:** No

Not in `IDocumentMetadata`, so it has no Firestore home. Used for the "v2", "v3" suffix in document
captions.

### `groupUserConnections`

- **Stores:** RTDB only
- **Location:** `DBPublication.groupUserConnections`, written at publish when the publisher is in a group
- **Applies to:** publication (published problem documents)
- **Runtime:** `DocumentModel.groupUserConnections` — **the prop exists but is never populated**
- **Updated by:** nothing
- **Reactive:** No

Records which group members were connected at publish time. `createDocumentFromPublication` reads the
record, converts it back into a map, and passes it to `openDocument`
([db.ts:1186](../../src/lib/db.ts#L1186)) — but `openDocument` does not destructure
`groupUserConnections` from its options ([db.ts:917](../../src/lib/db.ts#L917)) and neither
`createDocumentModel` call passes it on. So the map is computed and dropped, and the model prop is always
empty. No reader of `document.groupUserConnections` exists in `src/`.

Flagged as an observation. The data is still in RTDB, so this is recoverable if the feature is wanted;
if not, the prop and the publish-time write are both dead.

### `lastEditedAt`

- **Stores:** RTDB only
- **Location:** `/{classPath}/users/{uid}/documentMetadata/{key}/lastEditedAt`
- **Applies to:** all editable types
- **Runtime:** not surfaced on any model
- **Updated by:** set on disconnect and on unmount ([firebase.ts:212](../../src/lib/firebase.ts#L212))
- **Reactive:** No

Not declared in `DBBaseDocumentMetadata` — an undeclared child of the metadata record.

### `evaluation`

- **Stores:** RTDB only
- **Location:** `/{classPath}/users/{uid}/documentMetadata/{key}/evaluation/{evaluator}` —
  `{ aiPrompt?, timestamp }`
- **Applies to:** documents submitted for AI analysis; the `{evaluator}` segment comes from
  `appConfig.aiEvaluation`
- **Runtime:** not surfaced on any model
- **Updated by:** [firebase.ts:198](../../src/lib/firebase.ts#L198)
- **Reactive:** No — consumed server-side by the `on-analyzable-doc-written` cloud function trigger.

Also undeclared in `DBBaseDocumentMetadata`.

---

## Structural and bookkeeping fields

Present in the stored records but carrying no independent meaning; listed so the record shapes are fully
accounted for.

| Field | Where | Notes |
|---|---|---|
| `version` | every RTDB record | Always `"1.0"`. Never varied; no migration reads it. |
| `self` | every RTDB record | `{ uid, classHash, documentKey }` — the record's own coordinates, echoed for records reached by query. Stripped before the Firestore write. |
| `classHash` | RTDB `DBBaseProblemDocumentMetadata` | Duplicates `self.classHash`. Stripped before the Firestore write, where `context_id` serves the role. |
| `userId` | `DBPublication` | The publishing user. Plays the role `uid` plays elsewhere. |
| `documentKey` | type-specific records | Points at the real document, needed because publication records are keyed by push key rather than document key. |
| `teachers` | Firestore (legacy) | No code writes it to `documents/{key}` today; the rules still read it for legacy documents. |

---

## Model props with no stored field

Closing the loop from the other direction: these `DocumentModel` props are not persisted anywhere.

| Prop | Source at creation | Notes |
|---|---|---|
| `remoteContext` | the remote class's `context_id`, from the network-resources response | Client-side marker for teacher-network browsing; builds the remote read path and gates `fetchRemoteContent`. Never written. |
| `supportContentType` | `support.support.type`, from the supports store | Read once, to suppress property syncing for multiclass supports. |
| `comments` | never populated at runtime | Legacy per-tile comments. `setTileComments` exists with no persistence path; real comments live in the Firestore `comments` subcollection. |
| `groupUserConnections` | dropped in `openDocument` | See above — stored in RTDB but never reaches the model. |

The volatile props (`treeMonitor`, `contentStatus`, `savedLastHistoryEntryId`, `saveState`, …) are
runtime-only by construction and are not listed here.

Note also that `DocumentModel.metadata` — the view used to locate Firestore documents — exposes 12 props
and omits 8, including `contextId`. It is cast to `IDocumentMetadata` despite being structurally
incomplete.

---

## Remote and network documents

Remote documents are worth calling out separately because *every* field is non-reactive for them.

Their metadata comes from the `getNetworkResources_v1` cloud function, which does one-shot RTDB reads and
is invoked through a react-query `useQuery`. There is no listener anywhere in the remote path, so updates
arrive only on refetch.

The fields surfaced are a strict subset, and it varies by type
([network-resources.ts](../../src/hooks/network-resources.ts)):

| Remote document type | Fields surfaced |
|---|---|
| personal / learning-log publications | `key`, `title`, `properties`, `uid`, `originDoc`, `remoteContext` |
| teacher personal docs / learning logs | `key`, `title`, `properties`, `uid`, `remoteContext` |
| problem publications | `key`, `uid`, `remoteContext` — no title, visibility, or properties |
| teacher problem / planning docs | `key`, `uid`, `visibility`, `remoteContext` |

Giving these documents a Firestore metadata source is roadmap step 4, and it is the largest remaining
structural change: the client cannot read another class's Firestore metadata directly, so the cloud
function has to do it.

---

## Observations

Things this audit turned up that look unintended. Recorded here rather than in a ticket so the next
person to work in this area sees them; none has been changed.

1. **Personal/learning-log `visibility` does not round-trip in RTDB** — the update hook writes the generic
   metadata record while creation and the listener use the type-specific record. The Firestore mirror is
   correct, so the user-visible impact is limited to RTDB consumers.
2. **`groupUserConnections` is computed at publication-open and dropped** — `openDocument` never
   destructures it.
3. **Firestore `properties` is always `{}`** — overwritten at creation and never synced, despite being
   declared on both `IDocumentMetadata` and `DocumentMetadataModel`.
4. **Planning documents sync no metadata** — absent from every `enabled` list, so `visibility` is frozen
   at its creation value.
5. **`investigation` / `problem` / `unit` are declared on the RTDB metadata type but never written there.**
6. **The generic `documentMetadata/{key}/title` is written at creation and never updated.** Nothing reads
   it, so this is latent.
7. **`updateFirestoreDocumentProp` queries rather than addressing the document directly** — a
   `where("key", ...)` + `where("context_id", ...)` lookup, then updates every match. The `FIXME` at the
   call site notes this should no longer be necessary.

## Not verified

- Whether MST's `typecheck` rejects Firestore documents carrying the undeclared `network` key, which does
  reach it unfiltered. Worth confirming before relying on the validation behavior.
- Whether cloud functions write Firestore fields for publications that the client does not — only client
  code and `shared/` were audited in depth.
- Whether the `groupUserConnections` drop is a deliberate deprecation or a regression.
