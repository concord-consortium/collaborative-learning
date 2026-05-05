import React, { useState } from "react";
import { observer } from "mobx-react";
import { Instance } from "mobx-state-tree";
import { HistoryEntryType } from "../../models/history/history";
import { UndoStore } from "../../models/history/undo-store";
import { useStores } from "../../hooks/use-stores";

import "./history-entry-item.scss";

interface IHistoryEntryItemProps {
  entry: HistoryEntryType;
  index: number;
  previousEntryId?: string;
  /**
   * Which section of the history view this entry is being rendered in.
   * Drives attribution: in the local section, an entry without a uid is
   * by definition this user's (entries from other clients arrive via the
   * remote listener, which stamps them with their uploader's uid). In the
   * remote section, a missing uid indicates a legacy pre-feature entry.
   */
  section?: "local" | "remote";
  /**
   * UndoStore for the document, passed only in the local section. Used to
   * decorate entries that are currently on the undo stack and to highlight
   * the entry that the undo pointer is at.
   */
  undoStore?: Instance<typeof UndoStore>;
}

export const HistoryEntryItem: React.FC<IHistoryEntryItemProps> = observer(({
  entry,
  index,
  previousEntryId,
  section = "local",
  undoStore,
}) => {
  const { class: classStore, user } = useStores();
  const [expanded, setExpanded] = useState(false);

  const toggleExpanded = () => setExpanded(!expanded);

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3
    });
  };

  const patchCount = entry.records.reduce((total, record) => total + record.patches.length, 0);

  const author = (() => {
    if (entry.uid) {
      const classUser = classStore.getUserById(entry.uid);
      return {
        initials: classUser?.initials ?? entry.uid,
        fullName: classUser?.displayName,
      };
    }
    // No uid on the entry.
    if (section === "remote") return { initials: "?", fullName: undefined };
    // Local section. Source distinguishes how the entry got here.
    if (entry.source === "remote") {
      // remote-applied but legacy entry without uid
      return { initials: "?", fullName: undefined };
    }
    // "local" or "revert" — created on this client
    return { initials: user.initials, fullName: user.name };
  })();
  const authorDetail = author.fullName
    ? `${author.fullName} (${author.initials})`
    : author.initials;

  // Color the entry by its arrival source, but only in the local section —
  // the remote section is uniformly "remote" by construction, so a per-entry
  // accent there would just be noise.
  const sourceClass = section === "local" ? `source-${entry.source}` : "";

  // Undo-stack decoration. undoStore is passed only in the local section.
  // Entries currently on the stack get a shaded background; the entry the
  // undo pointer would undo next gets a more prominent highlight.
  const onUndoStack = undoStore?.findHistoryEntry(entry.id) !== undefined;
  const isUndoPointer = undoStore?.undoEntry?.id === entry.id;
  const undoStackClass = isUndoPointer
    ? "is-undo-pointer"
    : onUndoStack
      ? "on-undo-stack"
      : "";
  const undoableTitle = !entry.undoable
    ? "Not undoable"
    : isUndoPointer
      ? "Undoable — next undo target"
      : onUndoStack
        ? "Undoable — on undo stack"
        : "Undoable";

  return (
    <div className={`history-entry-item ${sourceClass} ${expanded ? "expanded" : ""}`}>
      <button className="history-entry-summary" onClick={toggleExpanded}>
        <span className="history-entry-expand">
          {expanded ? "▼" : "▶"}
        </span>
        <span className="history-entry-index">#{index}</span>
        <span className="history-entry-action" title={entry.action}>
          {entry.isRevert ? "~ " : ""}{entry.modelActionKey}
        </span>
        <span className="history-entry-patches" title="Number of patches">
          {patchCount}p
        </span>
        <span
          className={
            `history-entry-undoable ${entry.undoable ? "undoable" : "not-undoable"} ${undoStackClass}`
          }
          title={undoableTitle}
        >
          <span className="glyph">{entry.undoable ? "↩" : "✕"}</span>
        </span>
        <span className="history-entry-author" title={author.fullName ?? "Author"}>{author.initials}</span>
        <span className="history-entry-time">{formatTimestamp(entry.created)}</span>
      </button>
      {expanded && (
        <div className="history-entry-details">
          <div><strong>ID:</strong> {entry.id}</div>
          <div><strong>Model:</strong> {entry.model}</div>
          <div><strong>Action:</strong> {entry.action}</div>
          <div>
            <strong>Author:</strong> {authorDetail}
            {entry.uid && authorDetail !== entry.uid ? ` — ${entry.uid}` : ""}
          </div>
          {section === "local" && (
            <div>
              <strong>Source:</strong>{" "}
              <span className={`history-entry-source-swatch source-${entry.source}`} />
              {entry.source}
            </div>
          )}
          <div><strong>Previous Entry ID:</strong> {previousEntryId}</div>
          {entry.isRevert && (
            <>
              <div><strong>Revert of:</strong> {entry.revertsEntryId}</div>
              <div><strong>Triggering Batch:</strong> {entry.triggeringBatchIds.join(", ")}</div>
            </>
          )}
          <div><strong>Undoable:</strong> {entry.undoable ? "Yes" : "No"}</div>
          <div><strong>State:</strong> {entry.state}</div>
          <div><strong>Records:</strong> {entry.records.length}</div>
          {entry.records.map((record, recordIndex) => (
            <div key={recordIndex} className="history-entry-record">
              <div className="record-header">
                <strong>Record {recordIndex + 1}:</strong> {record.tree} - {record.action}
              </div>
              <div className="record-patches">
                <strong>Patches ({record.patches.length}):</strong>
                <pre>{JSON.stringify(record.patches, null, 2)}</pre>
              </div>
              <div className="record-inverse-patches">
                <strong>Inverse Patches ({record.inversePatches.length}):</strong>
                <pre>{JSON.stringify(record.inversePatches, null, 2)}</pre>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
