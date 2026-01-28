import React, { useState } from "react";
import { observer } from "mobx-react";
import { HistoryEntryType } from "../../models/history/history";

import "./history-entry-item.scss";

interface IHistoryEntryItemProps {
  entry: HistoryEntryType;
  index: number;
}

export const HistoryEntryItem: React.FC<IHistoryEntryItemProps> = observer(({
  entry,
  index
}) => {
  const [expanded, setExpanded] = useState(false);

  const toggleExpanded = () => setExpanded(!expanded);

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString();
  };

  const patchCount = entry.records.reduce((total, record) => total + record.patches.length, 0);

  return (
    <div className={`history-entry-item ${expanded ? "expanded" : ""}`}>
      <button className="history-entry-summary" onClick={toggleExpanded}>
        <span className="history-entry-expand">
          {expanded ? "▼" : "▶"}
        </span>
        <span className="history-entry-index">#{index + 1}</span>
        <span className="history-entry-action" title={entry.action}>
          {entry.modelActionKey}
        </span>
        <span className="history-entry-patches" title="Number of patches">
          {patchCount}p
        </span>
        {entry.undoable && (
          <span className="history-entry-undoable" title="Undoable">↩</span>
        )}
        <span className="history-entry-time">{formatTimestamp(entry.created)}</span>
      </button>
      {expanded && (
        <div className="history-entry-details">
          <div><strong>ID:</strong> {entry.id}</div>
          <div><strong>Model:</strong> {entry.model}</div>
          <div><strong>Action:</strong> {entry.action}</div>
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
