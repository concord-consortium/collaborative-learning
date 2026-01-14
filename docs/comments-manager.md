# Document Comments Manager

## Overview

The `DocumentCommentsManager` is a MobX-based class that manages a queue of pending comments for a document. It ensures proper ordering of automated comments (AI analysis, exemplars) while keeping the existing React hooks architecture for comment fetching.

### What Problem Does This Solve?

Previously, exemplar comments could appear before AI analysis comments because both systems operated independently. The comments manager provides centralized queue coordination to ensure:
1. AI analysis comments always appear first
2. Exemplar comments wait for AI analysis to complete
3. Future automated comment types can be easily added
4. UI shows accurate "waiting" states

### Why the Hybrid Approach?

After analyzing several options (specific solution, full manager, hybrid), the hybrid approach was chosen because it:
- Provides immediate value for AI/exemplar coordination
- Minimizes disruption to existing React hooks and React Query caching
- Creates a foundation for future migration to full manager control
- Reduces implementation risk

**See [Migration Guide](./comments-manager-migration-guide.md) for the path to complete migration to full manager control.**

## Current Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ User Action (Ideas button / Exemplar trigger)               │
│ → Queue pending comment in manager                          │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ React Hooks (useDocumentComments)                           │
│ → Fetch comments from Firestore                             │
│ → Return as arrays to components                            │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ ChatPanel useEffect                                         │
│ → Syncs hook comments to manager.comments array and         │
│   triggers manager.checkPendingComments()                   │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ Manager checks queue                                        │
│ → Runs completion checks for pending items                  │
│ → Removes completed items from queue                        │
│ → Posts local comments after remote comment is posted       │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ UI Updates (via MobX observability)                         │
│ → Waiting message appears/disappears                        │
│ → Comments appear in correct order                          │
└─────────────────────────────────────────────────────────────┘
```

### Key Components

**1. DocumentCommentsManager** (`src/models/document/document-comments-manager.ts`)
- MobX class attached to each `DocumentModel`
- Manages queue of pending comments
- Coordinates automatic posting when conditions are met

**2. Integration Points**
- **DocumentModel**: Creates manager instance in `afterCreate()`
- **BaseDocumentContent**: Computed property `isAwaitingRemoteComment`
- **ExemplarController**: Queues exemplars
- **Document Component**: Queues AI analysis when Ideas button clicked
- **ChatPanel**: Bridges React hooks to manager via `useEffect`

**3. Comment Queue**
Supports two types of pending comments:
- **Remote**: Waits for comment from remote server (has completion check function)
- **Local**: Waits to post comment after other comments already in the queue (has post function)

## How It Works Today

### 1. User Clicks Ideas Button

```typescript
// src/components/document/document.tsx
async handleIdeasButtonClick() {
  if (appConfig.aiEvaluation) {
    // Trigger AI analysis
    await firebase.setLastEditedNow(user, document.key, document.uid);

    // Queue pending AI comment in manager
    const docLastEditedTime = await firebase.getLastEditedTimestamp(user, document.key);
    const effectiveLastEdited = docLastEditedTime || Date.now();

    document.commentsManager.queuePendingRemoteComment(
      effectiveLastEdited,
      (comments) => {
        // Check if AI has responded
        const lastAIComment = [...comments]
          .reverse()
          .find(comment => comment.uid === kAnalyzerUserParams.id);

        return !!(lastAIComment &&
                 lastAIComment.createdAt.getTime() > effectiveLastEdited);
      }
    );
  }
}
```

**Result**: `document.isAwaitingRemoteComment` becomes `true`

### 2. Exemplar Rule Triggers

```typescript
// src/models/stores/exemplar-controller.ts
showRandomExemplar() {
  // Queue the exemplar - it will post after AI completes
  documentModel.commentsManager?.queueComment(
    newComment,
    userContext,
    documentModel.metadata,
    postExemplarComment
  );
}
```

**Result**: Exemplar is added to queue but not posted until other comments in the queue ahead of it are posted

### 3. Comments Arrive from Firestore

```typescript
// src/components/chat/chat-panel.tsx
const allComments = useMemo(() => {
  return [...comments||[], ...simplePathComments||[]]
    .filter((comment) => playbackTime ? comment.createdAt <= playbackTime : true)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}, [comments, simplePathComments, playbackTime]);

// Bridge: Sync hook comments to manager
useEffect(() => {
  if (document?.commentsManager) {
    document?.commentsManager?.setComments(allComments);
  }
}, [document, allComments]);
```

**Result**: Manager receives updated comments array and processes queue

### 4. Manager Processes Queue

```typescript
// src/models/document/document-comments-manager.ts
async checkPendingComments() {
  const toRemove: string[] = [];
  const toPost: IPendingExemplarComment[] = [];

  // First pass: identify what to remove and what to post
  for (const pending of this.pendingComments) {
    if (pending.type === REMOTE_COMMENT) {
      if (pending.checkCompleted(this.comments)) {
        toRemove.push(pending.id); // AI analysis complete!
      }
    } else {
      // Other comments should be posted after all preceding pending items are resolved.
      const indexOfThis = this.pendingComments.indexOf(pending);
      const allBeforeAreResolved = this.pendingComments
        .slice(0, indexOfThis)
        .every(p => toRemove.includes(p.id));

      if (allBeforeAreResolved) {
        toPost.push(pending);
        toRemove.push(pending.id);
      }
    }
  }

  // Remove resolved items first
  if (toRemove.length > 0) {
    runInAction(() => {
      this.pendingComments = this.pendingComments.filter(
        p => !toRemove.includes(p.id)
      );
    });
  }

  // Then post local comments
  for (const commentToPost of toPost) {
    await commentToPost.postFunction({ document, comment, context });
  }
}
```

**Result**: AI pending item removed, exemplar posts

### 5. UI Updates

```typescript
// src/components/chat/waiting-message.tsx
// Reads computed property
const isWaiting = content?.isAwaitingRemoteComment;

// src/models/document/base-document-content.ts
get isAwaitingRemoteComment() {
  const doc = getParentWithTypeName(self, "Document");
  if (doc?.commentsManager) {
    return doc.commentsManager.pendingComments.some((p: PendingComment) => p.postingType === REMOTE_COMMENT);
  }
}
```

**Result**: "Ada is thinking..." disappears instantly when AI comment arrives

## Key Design Patterns

### 1. Hybrid Monitoring
- React hooks continue to fetch comments (no disruption)
- Manager receives comments array via assignment
- ChatPanel `useEffect` bridges the two systems
- Simple and works with existing architecture

### 2. Queue Ordering
- Remote comment items block local comments
- Local comments wait for all preceding items
- Items removed from queue before posting (prevents UI flash)
- Order guaranteed by queue processing logic

## Files Modified

**Production Code:**
- `src/models/document/document-comments-manager.ts` (~300 LOC) - New manager class
- `src/models/document/document.ts` - Initializes manager
- `src/models/document/base-document-content.ts` - Computed property
- `src/models/stores/exemplar-controller.ts` - Uses manager queue
- `src/components/document/document.tsx` - Queues AI analysis
- `src/components/chat/chat-panel.tsx` - Bridges hooks to manager
- `src/components/chat/waiting-message.tsx` - Uses computed property
- `src/components/chat/chat-thread.tsx` - Uses computed property

**Tests:**
- `src/models/document/document-comments-manager.test.ts` (~434 LOC) - Comprehensive tests

**Documentation:**
- [`docs/comments-manager.md`](./comments-manager.md) - Current implementation
- [`docs/comments-manager-migration-guide.md`](./comments-manager-migration-guide.md) - Path to full manager control

## Current Limitations

The hybrid approach has some limitations:
1. **Manager doesn't control Firestore subscriptions** - Hooks still do this
2. **Potential for multiple listeners** - Each hook creates its own (though React Query helps)
3. **Can't customize Firestore queries** - Limited to what hooks provide
4. **Array-based storage** - Re-creates objects on each update (not using MST maps)

These are acceptable trade-offs for the hybrid approach. **See [Migration Guide](./comments-manager-migration-guide.md) for how to address these in Phase 2/3.**

## Testing

**Unit tests** verify:
- Queue operations (add, remove, check)
- Comment coordination and ordering
- Error handling
- Multiple exemplars during AI analysis
- Real-world scenarios (Ideas button → AI → exemplar flow)

## Benefits Achieved

- **Better Architecture** - Centralized comment coordination
- **Simpler Components** - ChatPanel no longer has complex AI completion logic
- **Extensible** - Easy to add new comment types
- **Low Risk** - Backward compatible, can be disabled
- **Foundation** - Ready for future full migration

## Next Steps

The current hybrid implementation is complete and working. For the path to full manager control (Phase 2/3), see [Migration Guide](./comments-manager-migration-guide.md).
