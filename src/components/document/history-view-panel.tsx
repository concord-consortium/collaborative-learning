import React, { useEffect, useState } from "react";
import { Instance } from "mobx-state-tree";
import { observer } from "mobx-react";
import { HistoryEntryItem } from "./history-entry-item";
import { useStores } from "../../hooks/use-stores";
import { DocumentModelType } from "../../models/document/document";
import { TreeManager } from "../../models/history/tree-manager";
import { HistoryEntry, HistoryEntrySnapshot, HistoryEntryType } from "../../models/history/history";
import { loadHistory, getHistoryPath } from "../../models/history/history-firestore";

import "./history-view-panel.scss";

interface IHistoryViewPanelProps {
  document: DocumentModelType;
}

export const HistoryViewPanel: React.FC<IHistoryViewPanelProps> = observer(({
  document
}) => {
  const stores = useStores();
  const { persistentUI, db } = stores;
  const [remoteHistoryEntries, setRemoteHistoryEntries] = useState<HistoryEntryType[]>([]);
  const [remoteHistoryError, setRemoteHistoryError] = useState<string | undefined>();

  // Get local history from document by casting to TreeManager instance
  const treeManager = document.treeManagerAPI as Instance<typeof TreeManager> | undefined;
  const localHistoryEntries = treeManager?.document.history || [];

  // Get history path for remote history
  const historyPath = getHistoryPath(document.key);

  const showRemoteHistory = persistentUI.showRemoteHistoryView;

  const handleToggleRemoteHistory = () => {
    persistentUI.toggleRemoteHistoryView();
  };

  const handleClose = () => {
    persistentUI.setShowHistoryView(false);
  };

  // Subscribe to remote history when showRemoteHistory is enabled
  useEffect(() => {
    if (!showRemoteHistory || !historyPath) {
      setRemoteHistoryEntries([]);
      setRemoteHistoryError(undefined);
      return;
    }

    const unsubscribe = loadHistory(db.firestore, historyPath, (entries: HistoryEntrySnapshot[], error) => {
      if (error) {
        setRemoteHistoryError(error.message);
        setRemoteHistoryEntries([]);
      } else {
        setRemoteHistoryError(undefined);
        setRemoteHistoryEntries(entries.map(snapshot => HistoryEntry.create(snapshot)));
      }
    });

    return () => unsubscribe();
  }, [showRemoteHistory, historyPath, db.firestore]);

  return (
    <div className="history-view-panel">
      <div className="history-view-header">
        <h3>Document History</h3>
        <button className="history-view-close" onClick={handleClose}>×</button>
      </div>

      {/* Local History Section */}
      <div className="history-view-section">
        <div className="history-view-section-header">
          <h4>Local History (Current Session)</h4>
          <span className="history-view-count">{localHistoryEntries.length} entries</span>
        </div>
        <div className="history-view-list">
          {localHistoryEntries.length === 0 ? (
            <div className="history-view-empty">No local history entries</div>
          ) : (
            localHistoryEntries.map((entry, index) => (
              <HistoryEntryItem key={entry.id} entry={entry} index={index} />
            ))
          )}
        </div>
      </div>

      {/* Remote History Toggle */}
      <div className="history-view-toggle">
        <label>
          <input
            type="checkbox"
            checked={showRemoteHistory}
            onChange={handleToggleRemoteHistory}
          />
          Show Remote History (Firestore)
        </label>
      </div>

      {/* Remote History Section */}
      {showRemoteHistory && (
        <div className="history-view-section">
          <div className="history-view-section-header">
            <h4>Remote History (Firestore)</h4>
            <span className="history-view-count">{remoteHistoryEntries.length} entries</span>
          </div>
          <div className="history-view-list">
            {remoteHistoryError ? (
              <div className="history-view-error">Error: {remoteHistoryError}</div>
            ) : remoteHistoryEntries.length === 0 ? (
              <div className="history-view-empty">No remote history entries</div>
            ) : (
              remoteHistoryEntries.map((entry, index) => (
                <HistoryEntryItem key={entry.id} entry={entry} index={index} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
});
