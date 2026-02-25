# Comment Ratings Design (CLUE-397)

## Motivation

As participants in scientific evidence discussions, users need to quickly agree or disagree with commented opinions. This adds thumbs up/down/not sure ratings to all comments, replacing the Ada-only agree buttons with a unified system.

## Requirements

- Rating buttons (yes/no/notSure) appear on every comment, including AI (Ada) comments
- Ratings save immediately on click, no "post" button needed
- Ratings are per-user and exclusive: one active rating per user per comment
- Clicking the same button toggles it off; clicking a different button replaces it
- Counts shown in parentheses when > 0
- Header text: "Do you agree with `<poster name>`?"
- Visible to all users, any user can rate any comment
- Enabled globally on all units that have comments
- Ratings are persistent across sessions and logged

## Data Model

### Firestore Schema

Add a `ratings` map field to `CommentDocument`:

```typescript
// firestore-schema.ts
interface CommentDocument {
  // ... existing fields ...
  ratings?: Record<string, "yes" | "no" | "notSure">;  // keyed by userId
}
```

### Type Definitions

```typescript
// shared/shared.ts
type RatingValue = "yes" | "no" | "notSure";
```

### Backward Compatibility

The existing `agreeWithAi` field and `on-document-summarized.ts` cloud function remain untouched. Legacy Ada agree data stays in `agreeWithAi`. New ratings (including on Ada comments) use the `ratings` map.

## Firestore Operations

### Writing a Rating

Direct client-side Firestore updates using dot notation:

```typescript
// Set rating
updateDoc(commentRef, { [`ratings.${userId}`]: "yes" });

// Remove rating (toggle off)
updateDoc(commentRef, { [`ratings.${userId}`]: deleteField() });
```

No cloud function needed.

### Security Rules

Users can only modify their own key in the ratings map:

```
match /comments/{commentId} {
  allow update: if request.auth != null
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['ratings'])
    && request.resource.data.ratings.diff(resource.data.ratings).affectedKeys()
        .hasOnly([request.auth.uid]);
}
```

### Real-time Updates

The existing `useCollectionOrderedRealTimeQuery` hook already listens for comment document changes, so rating updates propagate automatically to all connected clients.

## UI Design

```
+-------------------------------------+
| [Avatar] User Name         12:34 PM |
| Comment text goes here...           |
|                                     |
| Do you agree with User Name?        |
| [Yes (3)] [No (1)] [Not Sure]      |
+-------------------------------------+
```

- Reuse existing `YesIcon`, `NoIcon`, `NotSureIcon` SVG icons
- Active selection gets filled/highlighted style
- Counts in parentheses only when > 0; omitted when 0
- Buttons rendered in `comment-card.tsx` below every comment
- Replaces Ada-only agree button logic

### Key Difference from Ada Flow

The old Ada agree buttons gated text input: you picked agree/disagree *before* writing your reply, and the value attached to your *reply* comment. The new system is independent: ratings are stored on the *rated comment itself* via the `ratings` map field.

## Logging

```typescript
type CommentAction = "add" | "delete" | "expand" | "collapse" | "rate";

// Log payload for rate action
{
  focusDocumentId: string,
  focusTileId?: string,
  commentId: string,
  action: "rate",
  ratingValue: "yes" | "no" | "notSure" | "removed",
}
```

## Testing

- Unit tests for rating count computation (counting values from map)
- Unit tests for toggle logic (same button removes, different button replaces)
- Update `comment-card.test.tsx` to verify rating buttons render on all comments
- Update `comment-textbox.tsx` tests for removed Ada agree flow
- Firestore rules tests for security rule

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/firestore-schema.ts` | Add `ratings` field to `CommentDocument` |
| `src/components/chat/comment-card.tsx` | Render rating buttons on all comments, replace Ada-only logic |
| `src/components/chat/comment-card.scss` | Styles for counts, active state |
| `src/components/chat/comment-textbox.tsx` | Remove Ada agree buttons from text input flow |
| `src/hooks/document-comment-hooks.ts` | Add `useUpdateCommentRating` hook |
| `src/models/tiles/log/log-comment-event.ts` | Add "rate" action and log event |
| `shared/shared.ts` | `RatingValue` type, keep existing `IAgreeWithAi` |
| `firestore.rules` | Security rule for ratings field |
| `comment-card.test.tsx` | Test rating buttons, counts, toggle |
