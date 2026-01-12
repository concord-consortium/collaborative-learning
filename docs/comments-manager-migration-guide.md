# Migration Guide: From Hybrid to Full Comments Manager

**Current State**: Hybrid approach (manager coordinates queue, hooks fetch comments)
**Goal**: Manager handles all comment operations, remove React hooks dependency

This guide outlines the path to complete the transition from the current hybrid approach to full `DocumentCommentsManager` control.

## Migration Phases

### Phase 1: Hybrid ✅ (Current - Complete)
- Manager coordinates pending comment queue
- React hooks fetch comments from Firestore
- ChatPanel bridges hooks to manager
- **Status**: Implemented and working

### Phase 2: Manager Monitors Firestore (Future)
- Manager subscribes to Firestore directly
- Consider MST maps for comment storage
- Hooks may still provide interface (optional)
- **Complexity**: Medium

### Phase 3: Full MobX (Future)
- Convert ChatPanel to MobX observer
- Remove React hooks entirely
- Manager is sole source of comment data
- **Complexity**: Medium-High

## Phase 2: Direct Firestore Monitoring

### Goal
Enable the manager to subscribe to Firestore directly rather than receiving comments from React hooks.

### Benefits
- Single Firestore listener per document (no duplicates)
- Manager controls query parameters
- Faster updates (no hook intermediary)
- Better performance with MST maps
- Foundation for Phase 3

### Implementation Steps

#### 1. Enable Manager's Firestore Monitoring

The manager already has `startMonitoring()` and `stopMonitoring()` methods. Currently unused in hybrid approach.

**Activate in DocumentModel:**

```typescript
// src/models/document/document.ts
afterCreate() {
  self.commentsManager = new DocumentCommentsManager(self as DocumentModelType);

  // NEW: Start monitoring Firestore
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
}
```

#### 2. Consider MST Maps for Storage

**Current approach (arrays):**
```typescript
comments: CommentWithId[] = []
```

**MST map approach (better for Phase 2):**

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
  // Add other CommentDocument properties
});

const DocumentCommentsManager = types.model("DocumentCommentsManager", {
  // Store as maps keyed by ID
  legacyComments: types.map(CommentModel),
  simplifiedComments: types.map(CommentModel),
  // Combined view computed from the two maps
})
.volatile(self => ({
  pendingComments: [] as PendingComment[],
  unsubscribeLegacy: null as (() => void) | null,
  unsubscribeSimplified: null as (() => void) | null,
}))
.actions(self => ({
  startMonitoring(firestore, firestoreRoot, legacyPath, simplifiedPath) {
    // Monitor legacy path
    if (legacyPath) {
      const ref = firestore
        .collection(`${firestoreRoot}/${legacyPath}`)
        .orderBy("createdAt");

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
        self.checkPendingComments();
      });
    }

    // Monitor simplified path
    if (simplifiedPath) {
      const ref = firestore
        .collection(`${firestoreRoot}/${simplifiedPath}`)
        .orderBy("createdAt");

      self.unsubscribeSimplified = ref.onSnapshot(querySnapshot => {
        const commentsMap: Record<string, any> = {};
        querySnapshot.docs.forEach(doc => {
          commentsMap[doc.id] = {
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate()
          };
        });

        applySnapshot(self.simplifiedComments, commentsMap);
        self.checkPendingComments();
      });
    }
  },

  stopMonitoring() {
    self.unsubscribeLegacy?.();
    self.unsubscribeSimplified?.();
    self.unsubscribeLegacy = null;
    self.unsubscribeSimplified = null;
  }
}))
.views(self => ({
  // Expose as sorted array
  get comments() {
    const all: CommentModelType[] = [];
    self.legacyComments.forEach(c => all.push(c));
    self.simplifiedComments.forEach(c => all.push(c));
    return all.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  },

  get documentComments() {
    return this.comments.filter(c => c.tileId == null);
  },

  get tileComments() {
    return this.comments.filter(c => c.tileId != null);
  }
}));
```

**Why MST maps?**
- `applySnapshot` automatically diffs and only updates changed items
- MST reuses existing comment objects (doesn't recreate all)
- Better performance for large comment lists
- Handles additions, updates, and deletions automatically
- Individual comment observability
- **Pattern proven in `SortedDocuments`** (`src/models/stores/sorted-documents.ts`)

#### 3. Transition ChatPanel (Optional for Phase 2)

**Option A: Keep hooks as interface**
```typescript
// ChatPanel continues to use hooks
const { data: comments } = useDocumentComments(focusDocument);

// But hooks now just read from manager instead of Firestore
// (Requires implementing React Query integration in manager)
```

**Option B: Read directly from manager**
```typescript
// ChatPanel becomes observer
const ChatPanel: React.FC<IProps> = observer(({ focusDocument }) => {
  const document = focusDocument; // Assuming it's a DocumentModel
  const comments = document?.commentsManager?.comments || [];

  // No hooks needed!
});
```

#### 4. Update React Query Integration (If keeping hooks)

If keeping hooks as interface, manager should update React Query cache:

```typescript
import { useQueryClient } from 'react-query';

// In manager's onSnapshot callback
onSnapshot(querySnapshot => {
  // ... update manager state ...

  // Also update React Query cache
  const queryClient = getQueryClient(); // Get from env or context
  queryClient.setQueryData(['comments', documentPath], commentsArray);
});
```

### Phase 2 Testing Strategy

- Verify single Firestore listener per document (check Network tab)
- Confirm comments update in real-time
- Test with multiple components watching same document
- Verify MST map performance with large comment lists
- Ensure backward compatibility if keeping hooks
- Test disposal/cleanup thoroughly

### Phase 2 Rollout

1. Implement MST map storage
2. Enable manager monitoring in dev environment
3. Test thoroughly with production data
4. Gradual rollout: feature flag to toggle manager monitoring
5. Monitor performance and errors
6. Full rollout once stable
7. Remove hooks (transition to Phase 3)

## Phase 3: Full MobX Migration

### Goal
Complete the migration to full MobX architecture. Remove React hooks dependency entirely.

### Benefits
- Cleanest architecture
- No React hooks/MobX mixing
- Fastest updates (direct MobX reactivity)
- Simplest codebase (one pattern)
- Best performance

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
  const documentComments = manager?.documentComments || [];
  const tileComments = manager?.tileComments || [];

  const isWaitingForAI = document?.content?.isAwaitingAIAnalysis;

  // No hooks needed!
  // No useEffect needed!
  // MobX handles reactivity automatically

  return (
    <div className="chat-panel">
      {isWaitingForAI && <WaitingMessage />}
      {documentComments.map(comment => (
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

#### 3. Update All Consuming Components

Any component that uses comment hooks needs to:
1. Become an observer: `export const MyComponent = observer(({ ... }) => { ... })`
2. Read from manager: `const comments = document?.commentsManager?.comments`
3. Remove hook calls

**Components to update:**
- `ChatPanel` (main one)
- Any other components using comment hooks
- Check with: `grep -r "useDocumentComments" src/`

#### 4. Remove Hook Definitions

Once all consumers updated:
```typescript
// Delete these files (or mark deprecated):
// src/hooks/use-document-comments.ts
// src/hooks/use-unread-comments.ts
// etc.
```

#### 5. Update Manager API

Add convenience methods for common use cases:

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
  }
}))
```

### Phase 3 Testing Strategy

- Verify all observer components re-render on comment changes
- Test with React DevTools Profiler (ensure no excess renders)
- Verify disposal/cleanup when documents unmount
- Test with multiple documents open
- Ensure tile comments work correctly
- Test playback time filtering
- Verify unread comment tracking

### Phase 3 Rollout

1. Convert ChatPanel and test thoroughly
2. Find all other hook consumers
3. Convert remaining components one-by-one
4. Test each conversion
5. Remove hook definitions once all converted
6. Update documentation
7. Clean up old patterns

## Migration Checklist

### Phase 2
- [ ] Define MST CommentModel
- [ ] Convert manager to use MST maps
- [ ] Test `applySnapshot` with Firestore data
- [ ] Enable `startMonitoring` in DocumentModel
- [ ] Verify single listener per document
- [ ] Test performance with large comment lists
- [ ] Decide: keep hooks or go direct to manager
- [ ] If keeping hooks: implement React Query integration
- [ ] Remove ChatPanel `useEffect` bridge (no longer needed)
- [ ] Test thoroughly in dev
- [ ] Feature flag rollout in production
- [ ] Monitor and adjust
- [ ] Document new patterns

### Phase 3
- [ ] Convert ChatPanel to observer
- [ ] Test ChatPanel thoroughly
- [ ] Find all `useDocumentComments` consumers
- [ ] Convert each component to observer
- [ ] Test each component individually
- [ ] Remove hook definitions
- [ ] Clean up React Query configuration
- [ ] Add convenience methods to manager
- [ ] Update all documentation
- [ ] Team training on MobX patterns
- [ ] Full regression testing
- [ ] Production rollout

## Common Issues & Solutions

### Issue: Multiple listeners still being created
**Solution**: Verify manager is singleton per document. Check `addDisposer` is cleaning up properly.

### Issue: Comments not updating in UI
**Solution**: Ensure component is an observer. Check MobX observability with DevTools.

### Issue: Performance regression
**Solution**: Use MST maps. Profile with React DevTools. Ensure observers are granular.

### Issue: Memory leaks
**Solution**: Verify `stopMonitoring` is called in disposal. Check Firestore listeners are unsubscribed.

### Issue: Race conditions
**Solution**: Queue pending items before starting monitoring. Use `runInAction` for state updates.

## Decision Points

### Should you do Phase 2?

**Yes, if:**
- ✅ Adding more automated comment types
- ✅ Want better performance
- ✅ Want single Firestore listener per document
- ✅ Planning to do Phase 3 eventually

**No, if:**
- ❌ Hybrid approach meets all needs
- ❌ No planned additions to comment system
- ❌ Team prefers React hooks pattern
- ❌ Limited development time

### Should you do Phase 3?

**Yes, if:**
- ✅ Team comfortable with MobX patterns
- ✅ Want cleanest architecture
- ✅ Have time for thorough testing
- ✅ Phase 2 is already complete

**No, if:**
- ❌ Team prefers React hooks
- ❌ Phase 2 hybrid works fine
- ❌ Want to minimize risk

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

The hybrid approach (Phase 1) provides immediate value and is complete. Phases 2 and 3 offer architectural improvements but require significant effort.
