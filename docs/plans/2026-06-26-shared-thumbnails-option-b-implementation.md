# Shared personal-doc / learning-log thumbnails (sort view, peers) — Option B implementation

Alternative to Option A
([2026-06-26-shared-thumbnails-option-a-implementation.md](2026-06-26-shared-thumbnails-option-a-implementation.md)).
Same goal: a peer's personal-doc / learning-log thumbnail flips from private to
visible **reactively** in the **Sort Work view** when the owner shares it.
Background: [clue-554-shared-thumbnails-findings.md](../clue-554-shared-thumbnails-findings.md).

## The core idea

Instead of syncing visibility into the in-memory `DocumentModel` (Option A), make
the sort-view thumbnail **read its private/visible decision from the already-
reactive Firestore metadata** rather than from the full document's stale
`visibility`.

Key observation: the **grouped** sort path already does this — `SimpleDocumentItem`
computes `isPrivate` from the metadata model (`IDocumentMetadataModel`), so it's
already reactive. Only the **ungrouped** path
(`DecoratedDocumentThumbnailItem` → `ThumbnailDocumentItem`, which renders the
live canvas thumbnail) uses the full doc's visibility
([thumbnail-document-item.tsx:104](../../src/components/thumbnail/thumbnail-document-item.tsx#L104)).
Option B brings that one path in line with the grouped path.

## Goal & scope

- **In scope:** Sort Work view, ungrouped thumbnail path; peers (students);
  `PersonalDocument` + `LearningLogDocument`; the private/visible (`isPrivate`)
  decision. Content still renders from the loaded full document.
- **Out of scope:** nav-tab views (they render from `documents.all`, not Firestore
  metadata, so Option B's metadata-driven approach doesn't reach them — see
  comparison below); teachers (no-op); problem docs.

## Approach

Thread the reactive Firestore **metadata model** (`doc`, an
`IDocumentMetadataModel`) from the sort-view render down to
`ThumbnailDocumentItem`, which uses it as the source for the private/visible
decision instead of the full doc's stale `visibility`. Because the read happens
inside the leaf observer, **only the affected thumbnail re-renders** on a share —
not the whole section. Omitting the prop preserves today's behavior for every
other call site.

## Implementation

**1. [src/components/thumbnail/thumbnail-document-item.tsx](../../src/components/thumbnail/thumbnail-document-item.tsx)**

Add an optional `metadata` prop and use it as the accessibility source when
provided, falling back to the document's own computed metadata:
```ts
import { IDocumentMetadataModel } from "../../models/document/document-metadata-model";
import { isDocumentAccessibleToUser } from "../../models/document/document-utils";

interface IProps {
  // ...existing...
  metadata?: IDocumentMetadataModel;  // reactive Firestore metadata (sort-view path)
}
```
```ts
// was: const isPrivate = !document.isAccessibleToUser(user, documents);
const effectiveMetadata = props.metadata ?? document.metadata;
const isPrivate = !isDocumentAccessibleToUser(effectiveMetadata, user, documents);
```
This unifies on a single computation with a swappable metadata source.
`document.isAccessibleToUser` already routes through `document.metadata`
([document.ts:187-188](../../src/models/document/document.ts#L187-L188)), so the
fallback is behavior-identical to today. The component is already an `observer`,
so reading `metadata.visibility` (via the util) makes just this thumbnail
re-render on a share. Content still renders from `document.content` when
`!isPrivate`.

**2. [src/components/thumbnail/decorated-document-thumbnail-item.tsx](../../src/components/thumbnail/decorated-document-thumbnail-item.tsx)**

Add `metadata?: IDocumentMetadataModel` to its `IProps` and forward it verbatim to
`ThumbnailDocumentItem` (around [:74](../../src/components/thumbnail/decorated-document-thumbnail-item.tsx#L74)).

**3. [src/components/document/sorted-section.tsx](../../src/components/document/sorted-section.tsx)**

In `renderUngroupedDocument(doc: IDocumentMetadataModel)`
([:89-102](../../src/components/document/sorted-section.tsx#L89-L102)), pass the
reactive metadata model `doc` straight through:
```ts
const renderUngroupedDocument = (doc: IDocumentMetadataModel) => {
  const fullDocument = getDocument(doc.key);
  if (!fullDocument) return <div key={doc.key} className="loading-spinner"/>;
  return <DecoratedDocumentThumbnailItem
           key={doc.key}
           scale={0.1}
           document={fullDocument}
           metadata={doc}
           /* ...existing props... */
         />;
};
```
`SortedSection` does **not** read `doc.visibility` here, so it isn't re-rendered on
a share — only the leaf `ThumbnailDocumentItem` that reads `metadata.visibility`
is. No new imports or store access are needed in `SortedSection`.

`isDocumentAccessibleToUser` (used in the thumbnail) accepts an
`IDocumentMetadataBase` (uid, type, key, visibility) — exactly what the metadata
model provides
([document-utils.ts:93-106](../../src/models/document/document-utils.ts#L93-L106));
it's the same function the grouped `SimpleDocumentItem` path uses.

## Why this is reactive

The Firestore metadata `onSnapshot` patches `metadataDocsFiltered` /
`metadataDocsWithoutUnit` in place on a share. `ThumbnailDocumentItem` reads
`metadata.visibility` (via `isDocumentAccessibleToUser`), so that one observer
re-renders on the flip and shows the content. `SortedSection` never reads
visibility, so it stays put. No reaction, no cross-store mutation, no new
subscription.

## Performance

- **No new Firebase listeners / network / memory / reactions.**
- **New tracking:** each `ThumbnailDocumentItem` observes its own
  `metadata.visibility` (today it reads the full doc's `visibility`, which never
  changed for peers). `isDocumentAccessibleToUser` is O(1) per doc. This is the
  minimum possible — it reuses observation already flowing through the sort view.
- **Re-render granularity: per-thumbnail.** Only the doc that was shared
  re-renders; the section and the other thumbnails don't. (Finer than computing a
  flag up in `SortedSection`, which would re-run the whole section's `.map` on
  every share.)

## Edge cases & safety

- **Read-only:** Option B never mutates document state, so it has **none** of
  Option A's own-doc clobber / write-back-loop concerns. (Own docs resolve
  accessible via `isDocumentAccessibleToUser`'s `ownDocument` branch regardless.)
- **Content load:** when `isPrivate` flips false, the thumbnail renders the full
  doc's content (loaded on demand via `getDocument`/`fetchFullDocument`); shows a
  placeholder until loaded.
- **Dual source:** the thumbnail uses `document` for content/caption/key and
  `metadata` for the visibility decision. `SortedSection` always passes a matched
  pair (`getDocument(doc.key)` alongside `doc`), so they describe the same
  document; a caller that passed a mismatched pair would get a wrong accessibility
  result. Worth a one-line comment at the `metadata` prop noting it must describe
  the same doc as `document`.
- **Other call sites unaffected:** they omit `metadata` and fall back to
  `document.metadata` — behavior-identical to today.

## Testing

- **Unit:** confirm `isDocumentAccessibleToUser` covers the
  visibility/owner/teacher branches for a non-owner student
  (`visibility: "public" | "private"`).
- **Component (also exercises reactivity):** render `ThumbnailDocumentItem` with a
  `metadata` model whose `visibility: "private"` (non-owner) → assert the `private`
  class + `ThumbnailPrivateIcon`; then mutate `metadata.visibility` to `"public"`
  → assert the canvas renders. Mutating the metadata and seeing the leaf re-render
  directly verifies the reactivity (something the boolean variant couldn't test in
  isolation).
- **Manual (two-tab peer test):** identical to Option A's — Student 2 watches
  Student 1's doc flip from private placeholder to live thumbnail on share, with
  no refresh. (See the Option A doc for the exact demo URLs.)

## Option A vs Option B

| | Option A (sync into store) | Option B (thumbnail reads metadata) |
|---|---|---|
| Mechanism | MobX `reaction` in `SortedDocuments` syncs visibility/title → `documents.all` | Thread the reactive metadata model into the thumbnail; decide accessibility from it |
| New Firebase/network/memory | None | None |
| New tracking | A reaction firing on visibility/title/doc-set changes; mutates store models | Each thumbnail observes its own `metadata.visibility`; no mutation |
| Re-render granularity | Per-doc (mutates only changed docs) | Per-thumbnail (only the shared doc's thumbnail) |
| Files touched | 1 (`sorted-documents.ts`) | 3 (sorted-section + 2 thumbnail components, all additive/optional) |
| Mutates document state | Yes (needs own-doc exclusion + diff guard to avoid clobber/loops) | No (read-only — simpler safety story) |
| Also fixes title staleness for peers | Yes (syncs title too) | Not yet, but the same `metadata` prop makes it easy to add (read `metadata.title` for the caption) |
| Reaches nav tabs later | Yes — `documents.all` is what nav tabs render, so the same sync helps them | No — nav tabs don't use Firestore metadata; they'd need Option A's approach |
| Testability | Easy store-level jest test | Component test that mutates `metadata` and asserts re-render |
| Conceptual model | One source of truth (the in-memory doc stays correct) | Split: content from full doc, accessibility from metadata |

**Recommendation:** If the goal might later expand to nav tabs (the findings doc
flags that as likely future scope), **Option A** generalizes better and also fixes
peer title staleness, at the cost of a guarded store mutation. If we want the
smallest, lowest-risk, read-only change strictly for the sort view, **Option B**
(metadata-prop variant) is simpler, safer, and re-renders only the affected
thumbnail.

## Open questions

- Same product question as Option A: private peer docs shown as a private
  placeholder (current) vs. hidden until shared.
- The dual-source wrinkle (content from `document`, accessibility from `metadata`):
  acceptable given matched pairs, but note it at the prop so future callers keep
  them consistent.
- If we adopt B now and expand to nav tabs later, we'd add A-style syncing then —
  so consider whether to just do A once.
