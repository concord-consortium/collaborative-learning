import React, { useEffect } from "react";
import { Instance } from "mobx-state-tree";
import { observer } from "mobx-react";
import classNames from "classnames";
import { useStores } from "../../hooks/use-stores";
import { TreeManager } from "../../models/history/tree-manager";
import { FirestoreHistoryManager, HistoryStatus } from "../../models/history/firestore-history-manager";
import { DocumentModelType } from "../../models/document/document";
import { PlaybackControlComponent } from "./playback-control";

import "./playback.scss";

interface IProps {
  document: DocumentModelType | undefined;
  historyManager: FirestoreHistoryManager | undefined;
  requestedHistoryId: string | undefined;
}

export const PlaybackComponent: React.FC<IProps> = observer((props: IProps) => {
  const { document, historyManager } = props;
  const { displayedActiveNavTab: activeNavTab } = useStores();
  const treeManager = document?.treeManagerAPI as Instance<typeof TreeManager>;

  useEffect(() => {
    if (props.requestedHistoryId && historyManager) {
      historyManager.moveToHistoryEntryAfterLoad(props.requestedHistoryId);
    }
  }, [props.requestedHistoryId, historyManager]);

  const disablePlayback = false;
  const playbackComponentClass = classNames("playback-component show-control", activeNavTab,
                                            {"disabled" : disablePlayback});

  // The control builds a model around the tree manager when it mounts, so switching to
  // another document has to give it a new one rather than leave it holding the old.
  const playbackControls = historyManager?.historyStatus === HistoryStatus.HISTORY_LOADED
    ? <PlaybackControlComponent key={document?.key} treeManager={treeManager}
          requestedHistoryId={props.requestedHistoryId} />
    : <div className="playback-controls loading">
        {historyManager ? historyManager.historyStatusString : "Uninitialized"}
      </div>;

  const historyEntryRequestError = historyManager?.historyEntryRequestError;
  // The slider keeps the reader from going back past this position, so being there is the
  // moment to say why.
  const earliestReachablePosition = treeManager?.earliestReachablePosition ?? 0;
  const atOldestReachablePosition = earliestReachablePosition > 0 &&
    treeManager.numHistoryEventsApplied === earliestReachablePosition;

return (
    <div className={playbackComponentClass} data-testid="playback-component">
      {playbackControls}
      {/* Rendered whether or not there is anything to say. A seek resolves long after the
          reader's attention has moved on, and screen readers announce a live region reliably
          only when the region was already there and its contents changed. */}
      <div className="playback-history-request-error" data-testid="playback-history-request-error"
          role="alert">
        {historyEntryRequestError}
      </div>
      {/* Rendered from the start for the same reason. The history before this point can't be
          rebuilt, so the slider goes no further back. */}
      <div className="playback-history-unavailable" data-testid="playback-history-unavailable"
          role="status">
        {atOldestReachablePosition && "Earlier history isn't available."}
      </div>
    </div>
  );
});
PlaybackComponent.displayName = "PlaybackComponent";
