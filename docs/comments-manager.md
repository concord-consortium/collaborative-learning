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
- Maintains backward compatibility
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
│ → Syncs hook comments to manager.comments array             │
│ → Triggers manager.checkPendingComments()                   │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ Manager checks queue                                        │
│ → Runs completion checks for pending items                  │
│ → Removes completed items from queue                        │
│ → Posts exemplars when AI analysis is complete              │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ UI Updates (via MobX observability)                         │
│ → "Ada is thinking..." appears/disappears                   │
│ → Comments appear in correct order                          │
└─────────────────────────────────────────────────────────────┘
```

### Key Components

**1. DocumentCommentsManager** (`src/models/document/document-comments-manager.ts`)
- MobX class attached to each `DocumentModel`
- Manages queue of pending comments (AI analysis, exemplars, custom)
- Provides observable state: `isAwaitingAIAnalysis`, `hasPendingExemplars`
- Coordinates automatic posting when conditions are met

**2. Integration Points**
- **DocumentModel**: Creates manager instance in `afterCreate()`
- **BaseDocumentContent**: Computed property `isAwaitingAIAnalysis` delegates to manager
- **ExemplarController**: Queues exemplars when AI is pending
- **Document Component**: Queues AI analysis when Ideas button clicked
- **ChatPanel**: Bridges React hooks to manager via `useEffect`

**3. Comment Queue**
Supports three types of pending comments:
- **AI Analysis**: Waits for AI comment from server (has completion check function)
- **Exemplar**: Waits to post exemplar comment (has post function)
- **Custom**: Flexible for future use cases (has both check and post functions)

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

    document.commentsManager.queuePendingAIComment(
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

**Result**: `document.commentsManager.isAwaitingAIAnalysis` becomes `true`

### 2. Exemplar Rule Triggers

```typescript
// src/models/stores/exemplar-controller.ts
showRandomExemplar() {
  if (appConfig.aiEvaluation && documentModel.commentsManager?.isAwaitingAIAnalysis) {
    // Queue the exemplar - it will post after AI completes
    documentModel.commentsManager.queuePendingExemplarComment(
      newComment,
      userContext,
      documentModel.metadata,
      postExemplarComment
    );
  } else {
    // Post immediately
    postExemplarComment({ document, comment, context });
  }
}
```

**Result**: Exemplar is added to queue but not posted yet

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
    document.commentsManager.comments = allComments;
    document.commentsManager.checkPendingComments();
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
    if (pending.type === "ai-analysis") {
      if (pending.checkCompleted(this.comments)) {
        toRemove.push(pending.id); // AI analysis complete!
      }
    } else if (pending.type === "exemplar") {
      // Can post if all preceding items are resolved
      const allBeforeResolved = /* check logic */;
      if (allBeforeResolved) {
        toPost.push(pending);
        toRemove.push(pending.id);
      }
    }
  }

  // Remove resolved items FIRST (makes isAwaitingAIAnalysis false instantly)
  if (toRemove.length > 0) {
    runInAction(() => {
      this.pendingComments = this.pendingComments.filter(
        p => !toRemove.includes(p.id)
      );
    });
  }

  // Then post exemplars
  for (const exemplar of toPost) {
    await exemplar.postFunction({ document, comment, context });
  }
}
```

**Result**: AI pending item removed, `isAwaitingAIAnalysis` becomes `false`, exemplar posts

### 5. UI Updates

```typescript
// src/components/chat/waiting-message.tsx
// Reads computed property that delegates to manager
const isWaiting = content?.isAwaitingAIAnalysis;

// src/models/document/base-document-content.ts
get isAwaitingAIAnalysis() {
  const doc = getParentWithTypeName(self, "Document");
  if (doc?.commentsManager) {
    return doc.commentsManager.isAwaitingAIAnalysis; // Source of truth
  }
  return self.awaitingAIAnalysis; // Fallback for backward compatibility
}
```

**Result**: "Ada is thinking..." disappears instantly when AI comment arrives

## Key Design Patterns

### 1. Computed Property Delegation
Components continue to use `content.isAwaitingAIAnalysis`, but it delegates to the manager:
- Provides seamless migration
- Manager is source of truth
- Backward compatible (falls back to local flag if manager unavailable)

### 2. Hybrid Monitoring
- React hooks continue to fetch comments (no disruption)
- Manager receives comments array via assignment
- ChatPanel `useEffect` bridges the two systems
- Simple and works with existing architecture

### 3. Queue Ordering
- AI analysis items block exemplars
- Exemplars wait for all preceding non-exemplar items
- Items removed from queue before posting (prevents UI flash)
- Order guaranteed by queue processing logic

### 4. Graceful Degradation
- All code checks for manager existence (`?.commentsManager`)
- Falls back to old behavior if manager not present
- Can be disabled for rollback
- Backward compatible

## Files Modified

**Production Code:**
- `src/models/document/document-comments-manager.ts` (~300 LOC) - New manager class
- `src/models/document/document.ts` - Initializes manager
- `src/models/document/base-document-content.ts` - Computed property delegation
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

## Adding New Comment Types

The queue is extensible. To add a new automated comment type:

```typescript
// 1. Queue the pending item
document.commentsManager.queueCustomPendingComment(
  (comments) => {
    // Return true when your comment appears
    return comments.some(c => c.uid === YOUR_SYSTEM_ID);
  },
  async (params) => {
    // Post your comment if needed
    await postYourComment(params);
  },
  { /* any params your post function needs */ }
);

// 2. That's it! The manager handles ordering automatically
```

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

✅ **Better Architecture** - Centralized comment coordination
✅ **Simpler Components** - ChatPanel no longer has complex AI completion logic
✅ **Extensible** - Easy to add new comment types
✅ **Low Risk** - Backward compatible, can be disabled
✅ **Foundation** - Ready for future full migration

## Next Steps

The current hybrid implementation is complete and working. For the path to full manager control (Phase 2/3), see [Migration Guide](./comments-manager-migration-guide.md).
