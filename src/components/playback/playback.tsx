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

  const playbackControls = historyManager?.historyStatus === HistoryStatus.HISTORY_LOADED
    ? <PlaybackControlComponent treeManager={treeManager} />
    : <div className="playback-controls loading">
        {historyManager ? historyManager.historyStatusString : "Uninitialized"}
      </div>;

  const historyEntryRequestError = historyManager?.historyEntryRequestError;

return (
    <div className={playbackComponentClass} data-testid="playback-component">
      {playbackControls}
      {historyEntryRequestError &&
        <div className="playback-history-request-error" data-testid="playback-history-request-error"
            role="alert">
          {historyEntryRequestError}
        </div>
      }
    </div>
  );
});
PlaybackComponent.displayName = "PlaybackComponent";
