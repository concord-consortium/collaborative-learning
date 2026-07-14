import { observer } from "mobx-react";
import React, { useState } from "react";
import { useStores } from "../../hooks/use-stores";
import { commentTagId } from "../../models/stores/comment-tags";

import "./sort-work-add-tag.scss";

// Teacher-only "+ Add Tag" control shown below the "Not Tagged" section when documents are sorted
// by tag (Strategy) in the Sort Work view. Adding a tag writes it to Firestore; it syncs back into
// the effective tag list, which immediately creates a new (empty) sort section for it. A datalist
// gives typeahead over existing tag labels so teachers reuse tags rather than creating variants.
export const SortWorkAddTag: React.FC = observer(function SortWorkAddTag() {
  const { appConfig, commentTags, user } = useStores();
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  const canAdd = !!appConfig.showCommentTag && !!appConfig.allowCustomCommentTags && user.isTeacher;
  if (!canAdd) return null;

  const tags = commentTags.mergedWith(appConfig.commentTags);
  const trimmed = text.trim();
  // Disallow creating a tag that already exists, for tag hygiene: either the same display name
  // (case-insensitive) or one whose generated id collides with an existing tag key (which would
  // otherwise override that tag's label in the merged list).
  const isDuplicate = !!trimmed &&
    (Object.values(tags).some(label => label.trim().toLowerCase() === trimmed.toLowerCase()) ||
     Object.keys(tags).includes(commentTagId(trimmed)));

  const showError = error && !isDuplicate;
  const messageId = isDuplicate
    ? "add-tag-duplicate-msg"
    : showError ? "add-tag-error-msg" : undefined;

  const commit = async () => {
    if (!trimmed || isDuplicate || saving) return;
    setSaving(true);
    setError(false);
    try {
      await commentTags.addTag(trimmed, user.id);
      setText("");
      setAdding(false);
    } catch (e) {
      // Keep the entered text and the row open so the teacher can see it failed and retry.
      console.error("Failed to add comment tag", e);
      setError(true);
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setText("");
    setError(false);
    setAdding(false);
  };

  return (
    <div className="sort-work-add-tag" data-testid="sort-work-add-tag">
      {!adding
        ? <button
            type="button"
            className="add-tag-button"
            data-testid="sort-work-add-tag-button"
            onClick={() => setAdding(true)}
          >
            + Add Tag
          </button>
        : <div className="add-tag-row">
            <input
              type="text"
              list="sort-work-tag-suggestions"
              className="add-tag-input"
              data-testid="sort-work-add-tag-input"
              placeholder="New tag"
              aria-label="New tag name"
              aria-invalid={isDuplicate || showError}
              aria-describedby={messageId}
              value={text}
              autoFocus
              onChange={e => { setText(e.target.value); if (error) setError(false); }}
              onKeyDown={e => {
                if (e.key === "Enter") { e.preventDefault(); commit(); }
                else if (e.key === "Escape") { cancel(); }
              }}
            />
            <datalist id="sort-work-tag-suggestions">
              {Object.values(tags).map(label => <option key={label} value={label} />)}
            </datalist>
            <button
              type="button"
              className="add-tag-confirm"
              data-testid="sort-work-add-tag-confirm"
              disabled={!trimmed || isDuplicate || saving}
              onClick={commit}
            >
              Add
            </button>
            <button type="button" className="add-tag-cancel" onClick={cancel}>
              Cancel
            </button>
            {isDuplicate &&
              <span id="add-tag-duplicate-msg" role="alert"
                className="add-tag-duplicate" data-testid="sort-work-add-tag-duplicate">
                Tag already exists
              </span>}
            {showError &&
              <span id="add-tag-error-msg" role="alert"
                className="add-tag-error" data-testid="sort-work-add-tag-error">
                Couldn’t save tag — try again
              </span>}
          </div>
      }
    </div>
  );
});
