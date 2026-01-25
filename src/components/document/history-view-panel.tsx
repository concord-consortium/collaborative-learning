import React from "react";
import { Instance } from "mobx-state-tree";
import { observer } from "mobx-react";
import { HistoryEntryItem } from "./history-entry-item";
import { useStores } from "../../hooks/use-stores";
import { DocumentModelType } from "../../models/document/document";
import { TreeManager } from "../../models/history/tree-manager";

import "./history-view-panel.scss";

interface IHistoryViewPanelProps {
  document: DocumentModelType;
}

export const HistoryViewPanel: React.FC<IHistoryViewPanelProps> = observer(({
  document
}) => {
  const stores = useStores();
  const { persistentUI } = stores;

  // Get local history from document by casting to TreeManager instance
  const treeManager = document.treeManagerAPI as Instance<typeof TreeManager> | undefined;
  const localHistoryEntries = treeManager?.document.history || [];

  const handleClose = () => {
    persistentUI.setShowHistoryView(false);
  };

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
    </div>
  );
});
