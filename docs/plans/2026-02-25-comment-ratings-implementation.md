# Comment Ratings (CLUE-397) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add thumbs up/down/not-sure rating buttons to every comment, replacing the Ada-only agree flow.

**Architecture:** Ratings stored as a `ratings` map field on each `CommentDocument` in Firestore, keyed by userId. A new `useUpdateCommentRating` hook writes directly to Firestore using dot-notation updates. The existing real-time listener propagates changes to all clients automatically. The Ada-only agree buttons in `comment-textbox.tsx` are removed; new rating buttons render below each comment in `comment-card.tsx`.

**Tech Stack:** React 17, TypeScript, Firebase 8 (Firestore), MobX, Jest + React Testing Library

---

### Task 1: Add RatingValue type to shared types

**Files:**
- Modify: `shared/shared.ts`

**Step 1: Add the type**

After the existing `IAgreeWithAi` block (~line 229), add:

```typescript
export type RatingValue = "yes" | "no" | "notSure";
```

**Step 2: Verify types compile**

Run: `npx tsc --noEmit --project tsconfig.json 2>&1 | head -20`
Expected: No new errors

**Step 3: Commit**

```bash
git add shared/shared.ts
git commit -m "feat: add RatingValue type (CLUE-397)"
```

---

### Task 2: Add ratings field to CommentDocument

**Files:**
- Modify: `src/lib/firestore-schema.ts:42-52`

**Step 1: Add the field**

Add to the `CommentDocument` interface, after the `agreeWithAi` field (line 51):

```typescript
import type { IAgreeWithAi, RatingValue } from "shared/shared";

// In CommentDocument:
  ratings?: Record<string, RatingValue>;  // keyed by userId
```

Note: `IAgreeWithAi` is already imported. Add `RatingValue` to the existing import.

**Step 2: Verify types compile**

Run: `npx tsc --noEmit --project tsconfig.json 2>&1 | head -20`
Expected: No new errors

**Step 3: Commit**

```bash
git add src/lib/firestore-schema.ts
git commit -m "feat: add ratings field to CommentDocument (CLUE-397)"
```

---

### Task 3: Add logging support for rate action

**Files:**
- Modify: `src/lib/logger-types.ts`
- Modify: `src/models/tiles/log/log-comment-event.ts`

**Step 1: Add log event names**

In `src/lib/logger-types.ts`, after `COLLAPSE_COMMENT_THREAD_FOR_TILE` (line 68), add:

```typescript
  RATE_COMMENT_FOR_DOCUMENT,
  RATE_COMMENT_FOR_TILE,
```

**Step 2: Update log-comment-event.ts**

In `src/models/tiles/log/log-comment-event.ts`:

a) Update the `CommentAction` type (line 9):
```typescript
type CommentAction = "add" | "delete" | "expand" | "collapse" | "rate";
```

b) Update the `ILogComment` interface to add optional rating fields:
```typescript
export interface ILogComment extends Record<string, any> {
  focusDocumentId: string;
  focusTileId?: string;
  isFirst?: boolean;
  commentText: string;
  action: CommentAction;
  commentId?: string;          // used by "rate" action
  ratingValue?: string;        // "yes" | "no" | "notSure" | "removed"
}
```

c) Add `"rate"` to the `eventMap` in `logCommentEvent` (~line 48):
```typescript
    rate: focusTileId
            ? LogEventName.RATE_COMMENT_FOR_TILE
            : LogEventName.RATE_COMMENT_FOR_DOCUMENT,
```

**Step 3: Verify types compile**

Run: `npx tsc --noEmit --project tsconfig.json 2>&1 | head -20`
Expected: No new errors

**Step 4: Commit**

```bash
git add src/lib/logger-types.ts src/models/tiles/log/log-comment-event.ts
git commit -m "feat: add rate comment log events (CLUE-397)"
```

---

### Task 4: Write failing test for useUpdateCommentRating hook

**Files:**
- Create: `src/hooks/use-update-comment-rating.test.ts`

**Step 1: Write the test**

Note: The `useFirestore` mock returns only the firestore instance (no root), because `firestore.doc()` internally prepends the root folder. Callers must NOT manually prepend root.

```typescript
const DELETE_SENTINEL = { _type: "FieldValue.delete" };

jest.mock("firebase/app", () => ({
  __esModule: true,
  default: {
    firestore: {
      FieldValue: {
        delete: () => DELETE_SENTINEL
      }
    }
  }
}));

const mockUpdate = jest.fn().mockResolvedValue(undefined);
const mockDoc = jest.fn().mockReturnValue({ update: mockUpdate });

jest.mock("./firestore-hooks", () => ({
  useFirestore: () => [{ doc: mockDoc }]
}));

jest.mock("./use-user-context", () => ({
  useUserContext: () => ({ uid: "user1" })
}));

import { renderHook, act } from "@testing-library/react-hooks";
import { useUpdateCommentRating } from "./use-update-comment-rating";

describe("useUpdateCommentRating", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sets a rating on a comment", async () => {
    const { result } = renderHook(() => useUpdateCommentRating());
    await act(async () => {
      await result.current("documents/doc1/comments/comment1", "yes");
    });
    expect(mockDoc).toHaveBeenCalledWith("documents/doc1/comments/comment1");
    expect(mockUpdate).toHaveBeenCalledWith({ "ratings.user1": "yes" });
  });

  it("removes a rating when value is undefined", async () => {
    const { result } = renderHook(() => useUpdateCommentRating());
    await act(async () => {
      await result.current("documents/doc1/comments/comment1", undefined);
    });
    expect(mockDoc).toHaveBeenCalledWith("documents/doc1/comments/comment1");
    expect(mockUpdate).toHaveBeenCalledWith({
      "ratings.user1": DELETE_SENTINEL
    });
  });

  it("replaces an existing rating with a different value", async () => {
    const { result } = renderHook(() => useUpdateCommentRating());
    await act(async () => {
      await result.current("documents/doc1/comments/comment1", "no");
    });
    expect(mockUpdate).toHaveBeenCalledWith({ "ratings.user1": "no" });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest src/hooks/use-update-comment-rating.test.ts --no-coverage 2>&1 | tail -10`
Expected: FAIL — module not found

---

### Task 5: Implement useUpdateCommentRating hook

**Files:**
- Create: `src/hooks/use-update-comment-rating.ts`

**Step 1: Write the hook**

**IMPORTANT:** `firestore.doc(partialPath)` already prepends the root folder internally. Do NOT manually prepend `${root}/` — that doubles the root and causes "No document to update" errors.

```typescript
import firebase from "firebase/app";
import { useCallback } from "react";
import { RatingValue } from "../../shared/shared";
import { useFirestore } from "./firestore-hooks";
import { useUserContext } from "./use-user-context";

export function useUpdateCommentRating() {
  const [firestore] = useFirestore();
  const { uid } = useUserContext();

  return useCallback(
    async (commentPath: string, value: RatingValue | undefined) => {
      if (!uid) return;
      const docRef = firestore.doc(commentPath);
      if (value) {
        await docRef.update({ [`ratings.${uid}`]: value });
      } else {
        await docRef.update({ [`ratings.${uid}`]: firebase.firestore.FieldValue.delete() });
      }
    },
    [firestore, uid]
  );
}
```

**Step 2: Run test to verify it passes**

Run: `npx jest src/hooks/use-update-comment-rating.test.ts --no-coverage 2>&1 | tail -10`
Expected: PASS (2 tests)

**Step 3: Commit**

```bash
git add src/hooks/use-update-comment-rating.ts src/hooks/use-update-comment-rating.test.ts
git commit -m "feat: add useUpdateCommentRating hook with tests (CLUE-397)"
```

---

### Task 6: Write failing tests for rating UI in comment-card

**Files:**
- Modify: `src/components/chat/comment-card.test.tsx`

**Step 1: Add test setup and rating tests**

Add to the existing mock setup at the top of the file (inside the `jest.mock("../../hooks/use-stores"` block), add a mock for the user context. Then add these tests inside the existing `describe("CommentCard")`:

```typescript
// At top of file, add mock for the rating hook
const mockUpdateRating = jest.fn().mockResolvedValue(undefined);
jest.mock("../../hooks/use-update-comment-rating", () => ({
  useUpdateCommentRating: () => mockUpdateRating
}));

// Add these test cases inside describe("CommentCard"):

  it("renders rating buttons on every comment", () => {
    const postedComments: WithId<CommentDocument>[] = [
      { id: "c1", uid: "1", name: "User1", createdAt: new Date(), content: "hello" },
      { id: "c2", uid: "2", name: "User2", createdAt: new Date(), content: "world" }
    ];
    render((
      <ModalProvider>
        <CommentCard user={testUser} postedComments={postedComments} focusDocument="doc1" />
      </ModalProvider>
    ));
    // Each comment should have its own set of rating buttons
    expect(screen.getAllByTestId("comment-rating-buttons")).toHaveLength(2);
  });

  it("shows rating counts when > 0", () => {
    const postedComments: WithId<CommentDocument>[] = [
      {
        id: "c1", uid: "1", name: "User1", createdAt: new Date(), content: "hello",
        ratings: { "u1": "yes", "u2": "yes", "u3": "no" }
      }
    ];
    render((
      <ModalProvider>
        <CommentCard user={testUser} postedComments={postedComments} focusDocument="doc1" />
      </ModalProvider>
    ));
    expect(screen.getByTestId("rating-yes-count")).toHaveTextContent("2");
    expect(screen.getByTestId("rating-no-count")).toHaveTextContent("1");
    expect(screen.queryByTestId("rating-not-sure-count")).not.toBeInTheDocument();
  });

  it("shows header with poster name", () => {
    const postedComments: WithId<CommentDocument>[] = [
      { id: "c1", uid: "1", name: "Alice", createdAt: new Date(), content: "hello" }
    ];
    render((
      <ModalProvider>
        <CommentCard user={testUser} postedComments={postedComments} focusDocument="doc1" />
      </ModalProvider>
    ));
    expect(screen.getByText("Do you agree with Alice?")).toBeInTheDocument();
  });

  it("highlights the active rating for the current user", () => {
    const currentUser = { id: "u1", name: "Me" } as UserModelType;
    const postedComments: WithId<CommentDocument>[] = [
      {
        id: "c1", uid: "other", name: "Other", createdAt: new Date(), content: "hello",
        ratings: { "u1": "no" }
      }
    ];
    render((
      <ModalProvider>
        <CommentCard user={currentUser} postedComments={postedComments} focusDocument="doc1" />
      </ModalProvider>
    ));
    expect(screen.getByTestId("rating-no-button")).toHaveClass("selected");
    expect(screen.getByTestId("rating-yes-button")).not.toHaveClass("selected");
  });
```

**Step 2: Run tests to verify they fail**

Run: `npx jest src/components/chat/comment-card.test.tsx --no-coverage 2>&1 | tail -20`
Expected: FAIL — testids not found

---

### Task 7: Implement rating UI in comment-card.tsx

**Files:**
- Modify: `src/components/chat/comment-card.tsx`

**Step 1: Add imports and rating helper**

Add imports at top:
```typescript
import { RatingValue } from "../../../shared/shared";
import { useUpdateCommentRating } from "../../hooks/use-update-comment-rating";
```

Add a helper function for counting ratings (can be placed above the component or as a standalone function):
```typescript
function countRatings(ratings: Record<string, RatingValue> | undefined): Record<RatingValue, number> {
  const counts: Record<RatingValue, number> = { yes: 0, no: 0, notSure: 0 };
  if (ratings) {
    Object.values(ratings).forEach(v => { counts[v]++; });
  }
  return counts;
}
```

**Step 2: Add renderRatingButtons function inside the component**

Inside the `CommentCard` component, add:

```typescript
  const updateRating = useUpdateCommentRating();
  const commentsPath = useCommentsCollectionPath(focusDocument || "");

  const handleRate = useCallback((commentId: string, commentName: string, value: RatingValue) => {
    if (!commentsPath || !user) return;
    const commentPath = `${commentsPath}/${commentId}`;
    const currentRating = /* get from comment */ undefined; // will be passed in
    const newValue = currentRating === value ? undefined : value;
    updateRating(commentPath, newValue);
    logCommentEvent({
      focusDocumentId: focusDocument || "",
      focusTileId,
      commentId,
      commentText: "",
      action: "rate",
      ratingValue: newValue || "removed"
    });
  }, [commentsPath, user, updateRating, focusDocument, focusTileId]);

  const renderRatingButtons = (comment: WithId<CommentDocument>) => {
    const counts = countRatings(comment.ratings);
    const myRating = user?.id ? comment.ratings?.[user.id] : undefined;

    const buttons: { value: RatingValue; label: string; icon: JSX.Element; testId: string }[] = [
      { value: "yes", label: "Yes", icon: <YesIcon />, testId: "rating-yes-button" },
      { value: "no", label: "No", icon: <NoIcon />, testId: "rating-no-button" },
      { value: "notSure", label: "Not Sure", icon: <NotSureIcon />, testId: "rating-not-sure-button" },
    ];

    return (
      <div className="comment-ratings" data-testid="comment-rating-buttons">
        <div className="comment-ratings-header">
          Do you agree with {comment.name}?
        </div>
        <div className="comment-ratings-buttons">
          {buttons.map(({ value, label, icon, testId }) => (
            <div
              key={value}
              role="button"
              aria-label={label}
              className={classNames("rating-button", { selected: myRating === value })}
              onClick={(e) => {
                e.stopPropagation();
                const newValue = myRating === value ? undefined : value;
                if (commentsPath && user) {
                  updateRating(`${commentsPath}/${comment.id}`, newValue);
                  logCommentEvent({
                    focusDocumentId: focusDocument || "",
                    focusTileId,
                    commentId: comment.id,
                    commentText: "",
                    action: "rate",
                    ratingValue: newValue || "removed"
                  });
                }
              }}
              data-testid={testId}
            >
              {icon} {label}
              {counts[value] > 0 && (
                <span className="rating-count"
                      data-testid={`rating-${value === "notSure" ? "not-sure" : value}-count`}>
                  {counts[value]}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };
```

**Step 3: Render rating buttons below the comment text**

In the JSX, add `{renderRatingButtons(comment)}` **after** the `.comment-text` div (below the comment content, not between the header and text). This associates the rating buttons with the comment, not the student name.

```tsx
              <div className="comment-text">{comment.content}</div>
              {renderRatingButtons(comment)}
```

**Step 4: Add simplified path fallback for rating updates**

Comments may be stored at either the network-prefixed path or the simplified path. The click handler must try both:

```typescript
import { isSectionPath, escapeKey, RatingValue } from "../../../shared/shared";

// In component:
const simplifiedCommentsPath = focusDocument
  ? (isSectionPath(focusDocument)
    ? `curriculum/${escapeKey(focusDocument)}/comments`
    : `documents/${focusDocument}/comments`)
  : "";

// In click handler:
const primaryPath = `${commentsPath}/${comment.id}`;
const fallbackPath = `${simplifiedCommentsPath}/${comment.id}`;
updateRating(primaryPath, newValue).catch(() => {
  if (fallbackPath !== primaryPath) {
    updateRating(fallbackPath, newValue);
  }
});
```

**Step 5: Add required imports**

```typescript
import { useCommentsCollectionPath } from "../../hooks/document-comment-hooks";
import { logCommentEvent } from "../../models/tiles/log/log-comment-event";
```

**Step 5: Run tests**

Run: `npx jest src/components/chat/comment-card.test.tsx --no-coverage 2>&1 | tail -20`
Expected: PASS (all tests including new ones)

**Step 6: Commit**

```bash
git add src/components/chat/comment-card.tsx src/components/chat/comment-card.test.tsx
git commit -m "feat: add rating buttons to all comments (CLUE-397)"
```

---

### Task 8: Add styles for rating buttons

**Files:**
- Modify: `src/components/chat/comment-card.scss`

**Step 1: Add rating styles**

After the `.comment-agree-message` block (~line 128), add:

Note: The header inherits the parent font size (no explicit `font-size`) and SVG icons use their native 18px size, matching the original Ada agree buttons.

```scss
    .comment-ratings {
      margin-top: 4px;

      .comment-ratings-header {
        font-style: italic;
        color: $charcoal-dark-1;
      }

      .comment-ratings-buttons {
        display: flex;
        flex-direction: row;
        gap: 4px;
        margin-top: 2px;

        .rating-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 2px;
          padding: 2px 6px;
          height: 24px;
          border-radius: 5px;
          border: solid 1.5px $charcoal-light-1;
          cursor: pointer;
          font-size: 11px;

          svg {
            width: 18px;
            height: 18px;
          }

          .rating-count {
            margin-left: 2px;
            font-weight: bold;
          }

          &:hover, &.selected:hover {
            background-color: $charcoal-light-4;
          }
          &:active, &.selected {
            background-color: $charcoal-light-3;
          }
        }
      }
    }
```

**Step 2: Commit**

```bash
git add src/components/chat/comment-card.scss
git commit -m "feat: add styles for comment rating buttons (CLUE-397)"
```

---

### Task 9: Remove Ada agree buttons from comment-textbox

**Files:**
- Modify: `src/components/chat/comment-textbox.tsx`
- Modify: `src/components/chat/comment-textbox.test.tsx`

**Step 1: Remove showAgreeButtons prop and related code**

In `comment-textbox.tsx`:

a) Remove `showAgreeButtons` from the `IProps` interface and destructuring.

b) Remove `agreeWithAi` state (`useState<IAgreeWithAi|undefined>()`).

c) Remove `handleToggleAgreeWithAi` function.

d) Remove the entire `{showAgreeButtons && (...)}` JSX block (the `.comment-agree` div, lines 163-195).

e) Remove `showAgreeButtons` from the `minTextAreaHeight` calculation and textarea classNames.

f) Remove `agreeWithAi` from `onPostComment` call and `resetInputs`.

g) Clean up unused imports: `IAgreeWithAi` from `shared/shared`, `NoIcon`, `NotSureIcon`, `YesIcon`.

**Step 2: Remove showAgreeButtons from CommentCard**

In `comment-card.tsx`:

a) Remove `showAgreeButtons` useMemo and the prop passed to `<CommentTextBox>`.

b) Remove the `renderAgreeWithAi` function and its call in JSX — historical agree data is no longer displayed since ratings replace it.

c) Clean up: remove `kAnalyzerUserParams` import if no longer used.

**Step 3: Update tests**

In `comment-textbox.test.tsx`: No changes needed — existing tests don't test agree buttons.

In `comment-card.test.tsx`: Verify no tests reference `showAgreeButtons` or agree-related test IDs.

**Step 4: Run all affected tests**

Run: `npx jest src/components/chat/ --no-coverage 2>&1 | tail -20`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/chat/comment-textbox.tsx src/components/chat/comment-card.tsx
git commit -m "refactor: remove Ada-only agree buttons, replaced by universal ratings (CLUE-397)"
```

---

### Task 10: Update Firestore security rules

**Files:**
- Modify: `firestore.rules`

**Step 1: Update both comment update rules**

There are TWO `match /comments/{commentId}` blocks in `firestore.rules`:
1. Under curriculum documents (~line 322)
2. Under regular documents (~line 427)

In BOTH locations, update `isValidCommentUpdateRequest()` to allow rating updates from any user with access:

```
        function isValidRatingUpdate() {
          let affectedFields = request.resource.data.diff(resource.data).affectedKeys();
          return affectedFields.hasOnly(['ratings']);
        }

        function isValidCommentUpdateRequest() {
          return (userIsRequestUser() && preservesReadOnlyCommentFields())
            || isValidRatingUpdate();
        }
```

This allows:
- Comment authors to update their own comments (existing behavior)
- Any user with document access to update ONLY the `ratings` field

**Step 2: Verify rules syntax**

Run: `npm run lint 2>&1 | tail -10`
Expected: No errors (rules file isn't linted by ESLint, but verify no syntax issues)

**Step 3: Commit**

```bash
git add firestore.rules
git commit -m "feat: allow any user to update comment ratings field (CLUE-397)"
```

---

### Task 11: Run full test suite and fix issues

**Step 1: Run type checking**

Run: `npm run check:types 2>&1 | tail -20`
Expected: No errors

**Step 2: Run linting**

Run: `npm run lint 2>&1 | tail -20`
Expected: No errors

**Step 3: Run all chat-related tests**

Run: `npx jest src/components/chat/ src/hooks/document-comment-hooks src/hooks/use-update-comment-rating --no-coverage 2>&1 | tail -30`
Expected: All PASS

**Step 4: Fix any issues found**

Address any type errors, lint warnings, or test failures.

**Step 5: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address test/lint issues for comment ratings (CLUE-397)"
```

---

### Task 12: Manual smoke test checklist

These should be verified manually in the browser:

- [ ] Start dev server: `npm start`
- [ ] Open a document with comments in demo mode
- [ ] Verify rating buttons appear below every comment
- [ ] Click "Yes" — button highlights, count shows "(1)"
- [ ] Click "Yes" again — toggles off, count disappears
- [ ] Click "No" after "Yes" — "Yes" deselects, "No" selects
- [ ] Open same document in second browser tab — verify counts update in real time
- [ ] Verify Ada comments also show rating buttons
- [ ] Verify the old agree buttons no longer appear in the text input area
