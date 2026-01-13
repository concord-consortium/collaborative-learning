# Migration Guide: From Hybrid to Full Comments Manager

**Current State**: Hybrid approach (manager coordinates queue, hooks fetch comments)
**Goal**: Manager handles all comment operations, remove React hooks dependency

This guide outlines the path to complete the transition from the current hybrid approach to full `DocumentCommentsManager` control.

## Current Implementation

The manager is currently **intentionally minimal**, focused solely on queue coordination:
- Manages pending comment queue (AI analysis, exemplars)
- Coordinates comment ordering
- Does NOT monitor Firestore directly
- Does NOT include MST maps
- Does NOT include custom comment types

This is by design for the current hybrid approach. Future phases would add the missing capabilities.

## Migration Phases

### Phase 1: Hybrid ✅ (Current - Complete)
- Manager coordinates pending comment queue
- React hooks fetch comments from Firestore
- ChatPanel bridges hooks to manager via `useEffect`
- **Status**: Implemented and working

### Phase 2: Manager Monitors Firestore (Future)
- Add Firestore monitoring to manager
- Manager subscribes to Firestore directly
- Consider MST maps for comment storage
- **Optional**: Keep hooks as interface (observing manager via MobX)
- **Complexity**: Medium

### Phase 3: Full MobX (Future)
- Convert ChatPanel to MobX observer
- Remove React hooks entirely
- Manager is sole source of comment data
- **Complexity**: Medium-High

## Phase 2: Direct Firestore Monitoring

### Goal
Add Firestore subscription capabilities to the manager so it can fetch its own comments rather than receiving them from React hooks.

### Benefits
- Single Firestore listener per document (no duplicates)
- Manager controls query parameters
- Faster updates (no hook intermediary)
- Better performance with MST maps
- Foundation for Phase 3

### Prerequisites

Phase 2 requires adding Firestore monitoring infrastructure:
- Firestore subscriptions (`startMonitoring`, `stopMonitoring`)
- Comment paths tracking (`legacyComments`, `simplifiedComments`)
- Comment converter for Firestore timestamps
- Monitoring state tracking

### Implementation Steps

#### 1. Add Firestore Monitoring Properties

```typescript
// src/models/document/document-comments-manager.ts
import firebase from "firebase/app";

export class DocumentCommentsManager {
  // Add back Firestore monitoring infrastructure
  private firestore: firebase.firestore.Firestore | null = null;
  private unsubscribeLegacy: (() => void) | null = null;
  private unsubscribeSimplified: (() => void) | null = null;
  private firestoreRoot: string = "";

  comments: CommentWithId[] = [];

  // Track comments from each path separately
  legacyComments: CommentWithId[] = [];
  simplifiedComments: CommentWithId[] = [];

  pendingComments: PendingComment[] = [];
  isMonitoring: boolean = false;

  // ... rest of implementation
}
```

#### 2. Add Comment Converter

```typescript
const commentConverter = {
  toFirestore: (comment: CommentDocument) => {
    const { createdAt: createdAtDate, ...others } = comment;
    const createdAt = createdAtDate
      ? firebase.firestore.Timestamp.fromDate(createdAtDate)
      : undefined;
    return { createdAt, ...others };
  },
  fromFirestore: (doc: firebase.firestore.QueryDocumentSnapshot): CommentDocument => {
    const { createdAt, ...others } = doc.data();
    return {
      createdAt: createdAt?.toDate(),
      ...others
    } as CommentDocument;
  }
};
```

#### 3. Add Monitoring Methods

```typescript
/**
 * Start monitoring comments for the given document path
 */
startMonitoring(
  firestore: firebase.firestore.Firestore,
  firestoreRoot: string,
  legacyPath: string,
  simplifiedPath: string
) {
  if (this.isMonitoring) {
    this.stopMonitoring();
  }

  this.firestore = firestore;
  this.firestoreRoot = firestoreRoot;
  this.isMonitoring = true;

  // Monitor legacy path (for curriculum and user-posted comments)
  if (legacyPath) {
    const legacyRef = firestore
      .collection(`${firestoreRoot}/${legacyPath}`)
      .withConverter(commentConverter)
      .orderBy("createdAt");

    this.unsubscribeLegacy = legacyRef.onSnapshot(querySnapshot => {
      const docs = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      runInAction(() => {
        this.legacyComments = docs;
        this.updateComments();
      });
    });
  }

  // Monitor simplified path (for AI and system-posted comments)
  if (simplifiedPath) {
    const simplifiedRef = firestore
      .collection(`${firestoreRoot}/${simplifiedPath}`)
      .withConverter(commentConverter)
      .orderBy("createdAt");

    this.unsubscribeSimplified = simplifiedRef.onSnapshot(querySnapshot => {
      const docs = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      runInAction(() => {
        this.simplifiedComments = docs;
        this.updateComments();
      });
    });
  }
}

/**
 * Stop monitoring comments
 */
stopMonitoring() {
  this.unsubscribeLegacy?.();
  this.unsubscribeSimplified?.();
  this.unsubscribeLegacy = null;
  this.unsubscribeSimplified = null;
  this.isMonitoring = false;
}

/**
 * Update the combined comments list and check pending comments
 */
private updateComments() {
  this.comments = [...this.legacyComments, ...this.simplifiedComments]
    .sort((a, b) => {
      const ta = a.createdAt?.getTime() ?? 0;
      const tb = b.createdAt?.getTime() ?? 0;
      return ta - tb;
    });

  void this.checkPendingComments();
}
```

#### 4. Activate in DocumentModel

```typescript
// src/models/document/document.ts
afterCreate() {
  self.commentsManager = new DocumentCommentsManager();

  // Start monitoring Firestore
  const { db } = getEnv(self);
  if (db?.firestore && self.uid) {
    const legacyPath = `users/${self.uid}/documents/${self.key}/comments`;
    const simplifiedPath = `documents/${self.key}/comments`;

    self.commentsManager.startMonitoring(
      db.firestore,
      db.firestoreRoot,
      legacyPath,
      simplifiedPath
    );
  }

  addDisposer(self, () => {
    self.commentsManager?.stopMonitoring();
    self.commentsManager?.dispose();
  });
}
```

#### 5. Remove ChatPanel Bridge

Once manager monitors Firestore, remove the `useEffect` bridge:

```typescript
// src/components/chat/chat-panel.tsx

// DELETE THIS:
// useEffect(() => {
//   if (document?.commentsManager) {
//     document.commentsManager.comments = allComments;
//     void document.commentsManager.checkPendingComments();
//   }
// }, [document, allComments]);
```

#### 6. Transition Hooks (Two Options)

**Option A: Keep hooks as interface (observing manager)**

This maintains backward compatibility while using manager as source of truth:

```typescript
// src/hooks/use-document-comments.ts
import { useState, useEffect } from "react";
import { reaction } from "mobx";
import { DocumentModelType } from "../models/document/document";

export function useDocumentComments(document: DocumentModelType | undefined) {
  const [comments, setComments] = useState(
    document?.commentsManager?.comments || []
  );

  useEffect(() => {
    if (!document?.commentsManager) return;

    // ONE-WAY: Hook observes manager via MobX reaction
    const disposer = reaction(
      () => document.commentsManager?.comments,
      (newComments) => setComments(newComments || [])
    );

    return disposer;
  }, [document]);

  return { data: comments };
}
```

**Why this is good:**
- **One-way coupling**: Hook → Manager (not vice versa)
- **Manager stays pure**: No knowledge of React/hooks
- **Easy Phase 3**: Just delete hooks later
- **True MobX pattern**: Using `reaction` for observation
- **No React Query needed**: Direct MobX observation

**Option B: Remove hooks, use manager directly**

Skip to Phase 3 (see below).

### Phase 2 with MST Maps (Advanced)

For better performance with large comment lists, consider MST maps:

```typescript
import { types, applySnapshot, Instance } from "mobx-state-tree";

// Define Comment model
const CommentModel = types.model("Comment", {
  id: types.identifier,
  content: types.string,
  createdAt: types.Date,
  uid: types.string,
  name: types.maybe(types.string),
  network: types.maybe(types.string),
  tileId: types.maybe(types.string),
});

const DocumentCommentsManager = types.model("DocumentCommentsManager", {
  // Store as maps keyed by ID
  legacyComments: types.map(CommentModel),
  simplifiedComments: types.map(CommentModel),
})
.volatile(self => ({
  pendingComments: [] as PendingComment[],
  unsubscribeLegacy: null as (() => void) | null,
  unsubscribeSimplified: null as (() => void) | null,
}))
.actions(self => ({
  startMonitoring(firestore, firestoreRoot, legacyPath, simplifiedPath) {
    // ... setup ...

    self.unsubscribeLegacy = ref.onSnapshot(querySnapshot => {
      const commentsMap: Record<string, any> = {};
      querySnapshot.docs.forEach(doc => {
        commentsMap[doc.id] = {
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate()
        };
      });

      // MST automatically handles adds/updates/removes
      applySnapshot(self.legacyComments, commentsMap);
    });
  }
}))
.views(self => ({
  // Expose as sorted array
  get comments() {
    const all: CommentModelType[] = [];
    self.legacyComments.forEach(c => all.push(c));
    self.simplifiedComments.forEach(c => all.push(c));
    return all.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }
}));
```

**Benefits:**
- `applySnapshot` automatically diffs and only updates changed items
- MST reuses existing comment objects (doesn't recreate all)
- Better performance for large comment lists
- Individual comment observability
- **Pattern proven in `SortedDocuments`** (`src/models/stores/sorted-documents.ts`)

**When to use:**
- Large comment lists (50+ comments)
- Need individual comment observability
- Building full MobX/MST architecture

### Phase 2 Testing Strategy

- [ ] Verify single Firestore listener per document (check Network tab)
- [ ] Confirm comments update in real-time
- [ ] Test with multiple components watching same document
- [ ] Verify queue coordination still works
- [ ] Ensure disposal/cleanup is thorough

### Phase 2 Rollout

1. Implement monitoring infrastructure in manager
2. Test thoroughly in dev environment
3. Feature flag: `enableManagerMonitoring`
4. Gradual rollout with monitoring
5. If keeping hooks: convert to MobX observation pattern
6. Remove ChatPanel bridge once stable
7. Proceed to Phase 3 or stop here

## Phase 3: Full MobX Migration

### Goal
Complete migration to full MobX architecture. Remove React hooks dependency entirely.

### Benefits
- Cleanest architecture
- No React hooks/MobX mixing
- Fastest updates (direct MobX reactivity)
- Simplest codebase (one pattern)
- Best performance

### Prerequisites
- Phase 2 complete
- Manager monitoring Firestore successfully
- Team comfortable with MobX patterns

### Implementation Steps

#### 1. Convert ChatPanel to Observer

```typescript
// src/components/chat/chat-panel.tsx
import { observer } from "mobx-react-lite";

export const ChatPanel: React.FC<IProps> = observer(({
  user,
  focusDocument,
  activeNavTab
}) => {
  const document = focusDocument; // DocumentModel
  const manager = document?.commentsManager;

  // Read directly from manager (MobX makes this reactive)
  const allComments = manager?.comments || [];
  const isWaitingForAI = document?.content?.isAwaitingAIAnalysis;

  // No hooks needed!
  // No useEffect needed!
  // MobX handles reactivity automatically

  return (
    <div className="chat-panel">
      {isWaitingForAI && <WaitingMessage />}
      {allComments.map(comment => (
        <CommentComponent key={comment.id} comment={comment} />
      ))}
    </div>
  );
});
```

#### 2. Remove React Hooks

Delete or stop using:
- `useDocumentComments`
- `useDocumentCommentsAtSimplifiedPath`
- `useUnreadDocumentComments`
- Related React Query configuration

Find all consumers:
```bash
grep -r "useDocumentComments" src/
```

#### 3. Update All Consuming Components

Any component that uses comment hooks needs to:
1. Become an observer: `export const MyComponent = observer(({ ... }) => { ... })`
2. Read from manager: `const comments = document?.commentsManager?.comments`
3. Remove hook calls

#### 4. Add Convenience Methods to Manager

```typescript
.views(self => ({
  // Get comments for specific tile
  getTileComments(tileId: string) {
    return this.comments.filter(c => c.tileId === tileId);
  },

  // Get unread comments
  getUnreadComments(lastReadTime: Date) {
    return this.comments.filter(c => c.createdAt > lastReadTime);
  },

  // Filter by playback time
  getCommentsUntil(playbackTime: Date) {
    return this.comments.filter(c => c.createdAt <= playbackTime);
  },

  get documentComments() {
    return this.comments.filter(c => c.tileId == null);
  },

  get tileComments() {
    return this.comments.filter(c => c.tileId != null);
  }
}))
```

#### 5. Remove Hook Definitions

Once all consumers updated:
```typescript
// Delete these files:
// src/hooks/use-document-comments.ts
// src/hooks/use-unread-comments.ts
```

### Phase 3 Testing Strategy

- [ ] Verify all observer components re-render on comment changes
- [ ] Test with React DevTools Profiler (ensure no excess renders)
- [ ] Verify disposal/cleanup when documents unmount
- [ ] Test with multiple documents open
- [ ] Ensure tile comments work correctly
- [ ] Test playback time filtering
- [ ] Verify unread comment tracking

### Phase 3 Rollout

1. Convert ChatPanel and test thoroughly
2. Find all other hook consumers
3. Convert remaining components one-by-one
4. Test each conversion
5. Remove hook definitions once all converted
6. Clean up React Query configuration
7. Update documentation

## Migration Checklist

### Phase 2: Add Firestore Monitoring
- [ ] Add Firestore properties to manager
- [ ] Implement `commentConverter`
- [ ] Add `startMonitoring()` method
- [ ] Add `stopMonitoring()` method
- [ ] Add `updateComments()` private method
- [ ] Activate in `DocumentModel.afterCreate()`
- [ ] Remove ChatPanel `useEffect` bridge
- [ ] **IF keeping hooks**: Convert to MobX `reaction` pattern
- [ ] **OR**: Proceed directly to Phase 3
- [ ] Consider MST maps for large lists

### Phase 3: Remove Hooks
- [ ] Convert ChatPanel to observer
- [ ] Test ChatPanel thoroughly
- [ ] Find all `useDocumentComments` consumers
- [ ] Convert each component to observer
- [ ] Test each component individually
- [ ] Add convenience methods to manager
- [ ] Remove hook definitions
- [ ] Clean up React Query configuration
- [ ] Update all documentation

## Reference: MST Map Pattern

The MST map pattern is used successfully in `SortedDocuments` (`src/models/stores/sorted-documents.ts`):

```typescript
const SortedDocuments = types.model("SortedDocuments", {
  documents: types.map(DocumentMetadata)
})
.actions(self => ({
  watchFirestoreMetaDataDocs(params) {
    // Monitors Firestore
    // Uses applySnapshot to sync
    // Provides sorted views
  }
}))
.views(self => ({
  get sortedDocuments() {
    return Array.from(self.documents.values())
      .sort((a, b) => /* sorting logic */);
  }
}));
```

Apply this same pattern to `DocumentCommentsManager` for Phase 2/3.

## Summary

The **hybrid approach (Phase 1) is complete and sufficient** for current needs. It focuses on queue coordination only.

**Phase 2** would require adding Firestore monitoring infrastructure. If keeping hooks, use MobX `reaction` pattern (not React Query updates) to maintain proper architectural boundaries.

**Phase 3** provides the cleanest architecture but requires significant effort.
