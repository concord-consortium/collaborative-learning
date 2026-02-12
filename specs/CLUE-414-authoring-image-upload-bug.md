# Some Images Don't Upload to CLUE Authoring

**Jira**: https://concord-consortium.atlassian.net/browse/CLUE-414

**Status**: **Closed**

## Overview

Image uploads in the CLUE authoring media library silently fail for filenames containing spaces (and potentially other special characters), showing a false "Upload completed!" message due to missing error handling in the frontend upload flow.

Curriculum authors using the CLUE authoring system are unable to upload images with certain filenames (e.g. containing spaces). When they attempt an upload, the UI displays a success confirmation, but the image never appears in the media library. This affects the content authoring workflow for the MSU Inscriptions project, preventing authors from adding images to curriculum materials without first manually renaming files to remove spaces and special characters.

Investigation revealed two distinct bugs plus one minor issue:

1. **Frontend error handling** (`media-library.tsx`) does not check the API response's `success` field. The `api.post()` method returns `{success: false, error: "..."}` for server errors (rather than throwing), so the `catch` block never fires, and the UI always shows "Upload completed!" regardless of the actual outcome.
2. **Server-side filename validation** (`put-image.ts`) uses regex `/^[a-zA-Z0-9._-]+$/` which rejects spaces. The filename "hl 2.3.png" is rejected with a 400 error.
3. The Firebase metadata update in `put-image.ts` is not awaited, creating a potential race condition where the success response is sent before Firebase is updated.

## Requirements

- The frontend upload handler must check `response.success` and display the appropriate error message when an upload fails
- The error message from the server must be displayed to the user (e.g. "Invalid fileName: only alphanumeric, dash, underscore, and dot are allowed.")
- The frontend should auto-sanitize filenames before uploading, using these rules:
  - Replace any character not matching `[a-zA-Z0-9._-]` with a hyphen
  - Collapse consecutive hyphens into a single hyphen
  - Trim leading/trailing hyphens (excluding the extension)
  - If the sanitized basename is empty (e.g. "   .png"), fall back to a generated name like `image.png`
  - Show the sanitized filename to the user in the upload progress area (informational, no extra confirmation step for the name change itself)
- If sanitization changed the filename AND the sanitized name matches an existing image in the library, warn the user before uploading that the existing file will be overwritten. If the user declines, cancel the upload. (Intentional re-uploads with an already-valid filename should overwrite silently as before.)
- The Firebase metadata update in `put-image.ts` should be awaited before sending the success response to the client
- Post-upload UX changes (auto-switching tabs, select button) are deferred — focus on the bug fix only

## Technical Notes

**Key files:**
- `authoring-api/src/routes/put-image.ts` — Server-side image upload endpoint
- `src/authoring/components/media-library.tsx` — Frontend media library UI with upload handling
- `src/authoring/hooks/use-authoring-api.tsx` — API client that returns `{success: false}` on error (doesn't throw)
- `src/authoring/hooks/use-curriculum.tsx` — Firebase listener for file metadata (real-time updates)
- `authoring-api/src/helpers/db.ts` — Firebase path helpers and key escaping

**Error handling pattern:**
The `api.post()` in `use-authoring-api.tsx` returns `ApiErrorResponse` (`{success: false, error: string}`) for non-2xx responses rather than throwing. All callers must check `response.success`. The `saveContent` function in `use-curriculum.tsx` correctly checks `response.success` — the `handleUpload` in `media-library.tsx` should follow the same pattern.

**Sanitization source of truth:**
The server-side regex `/^[a-zA-Z0-9._-]+$/` in `put-image.ts` is the canonical validation. The frontend `sanitizeFileName` utility must produce filenames that pass this regex. If the server regex is ever updated, the frontend sanitization must be updated to match.

**Filename escaping:**
Firebase keys are escaped with `escapeFirebaseKey()` (e.g. `/` -> `%2F`, `.` -> `%2E`). The client uses `decodeURIComponent()` to unescape. Since filenames are auto-sanitized on the frontend to only contain `[a-zA-Z0-9._-]`, no special Firebase key escaping is needed beyond the existing `/` and `.` handling for the `images/filename.ext` path structure.

## Out of Scope

- Uploading non-image file types
- Drag-and-drop from external URLs (only local file upload)
- Changes to the GitHub repository structure or image storage location
- Bulk image upload functionality

## Decisions

### Should filenames with spaces be accepted or auto-sanitized?
**Context**: The current validation regex rejects spaces. Users commonly have spaces in filenames. Auto-sanitizing could silently rename files, which might confuse users but avoids upload failures.
**Options considered**:
- A) Auto-sanitize: replace spaces (and other invalid characters) with hyphens, show the sanitized name to the user before/during upload
- B) Accept spaces: broaden the regex to allow spaces in filenames
- C) Reject with clear error: keep the current validation but ensure the error message is visible to the user with guidance on renaming

**Decision**: A) Auto-sanitize. The frontend sanitizes filenames before sending to the server, replacing spaces and invalid characters with hyphens. The sanitized name is shown to the user during upload.

---

### Should the upload tab auto-switch to the images tab after successful upload?
**Context**: The bug report mentions the user can't select the image right away after upload. Currently after upload, the user must manually switch to the Existing Images tab.
**Options considered**:
- A) Auto-switch to Existing Images tab after successful upload, with the new image pre-selected
- B) Add a "Select this image" button on the upload success state
- C) Keep current behavior (user manually switches tabs) — focus only on the bug fix

**Decision**: C) Keep current behavior. Post-upload UX improvements are out of scope for this bug fix.

---

### Sanitized filename display: informational or confirmation?
**Context**: The requirement says "show the sanitized name to the user during upload" but doesn't clarify whether the user should see a confirmation before upload begins (allowing them to cancel/rename) or just see the sanitized name in the upload progress area.

**Decision**: Informational only, no extra confirmation step for the name change itself. The "Renamed from" message is required for transparency.

---

### Filename collision risk when sanitization produces duplicate names
**Context**: If a user uploads "my file.png" and later uploads "my-file.png", both sanitize to "my-file.png". The server overwrites the existing file. The user would not be warned.

**Decision**: Add an overwrite warning, but only when the original filename was changed by sanitization AND the sanitized name matches an existing file. Intentional re-uploads with valid filenames overwrite silently as before (preserving existing behavior).

---

### Overwrite warning: scope of when it fires
**Context**: The overwrite warning requirement could apply to ALL re-uploads or only sanitization-caused collisions. Universal warnings would change existing behavior where re-uploading "diagram.png" over existing "diagram.png" silently overwrites.

**Decision**: Sanitization-only. Warning only fires when the original filename was changed by sanitization AND the sanitized name matches an existing file.

---

### sanitizeFileName: dot-only basenames
**Context**: A filename like ". .png" would sanitize the basename to ".", producing "..png" — technically valid but odd.

**Decision**: Added fallback check for dot-only basenames (`/^\.+$/`). ". .png" now falls back to "image.png".

---

### Trailing-dot filenames
**Context**: Filenames ending in "." can be problematic on some platforms and in URLs. The server regex technically allows them.

**Decision**: Strip trailing dots from the final sanitized result. Also strip when the extension sanitizes to just ".". The `sanitizeFileName` function handles both cases.

---

### Leading-dot filenames (.bashrc-style)
**Context**: Leading-dot filenames like ".bashrc" pass validation but are unusual for an image library.

**Decision**: Allow as-is. Rare for images but valid per the server regex. Documented as intentional.

---

### Implementation: merge error handling and sanitization steps
**Context**: Both the error handling fix and sanitization changes modify `handleUpload` in `media-library.tsx`.

**Decision**: Merged into a single implementation step to avoid rework on the same function.

---

### Implementation: window.confirm for overwrite warning
**Context**: `window.confirm()` is a synchronous blocking call that can't be styled and is hard to test.

**Decision**: Acceptable for this bug fix. Simple and keeps scope minimal. Can be upgraded to a React dialog in a follow-up if needed.

---

### Implementation: sanitization placement in handleUpload
**Context**: Sanitization and overwrite check could happen inside `reader.onloadend` (after file read) or at the top of `handleUpload` (before file read).

**Decision**: Place at the top of `handleUpload`, before `reader.readAsDataURL`. Since `sanitizeFileName` only needs `file.name`, this avoids an awkward flash of upload preview before the overwrite confirm dialog.

---

### Implementation: automated tests for media-library.tsx
**Context**: The `media-library.tsx` component doesn't have an existing test file. The error handling and overwrite warning changes don't have automated tests.

**Decision**: Manual acceptance criteria are sufficient for this bug fix. The `sanitizeFileName` utility has thorough unit tests (15 test cases). Component-level tests can be added in a follow-up.

---

### Firebase await tradeoff
**Context**: If the Firebase update fails after the GitHub upload succeeds, the image will exist on GitHub but won't be tracked in Firebase metadata (orphaned).

**Decision**: The endpoint should return an error to the client — don't claim success if metadata wasn't written. This is an improvement over the previous fire-and-forget approach. The existing `catch` block should include enough context (branch, unit, filename, SHA) to identify orphaned images for future cleanup.
