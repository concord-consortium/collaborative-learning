import React, { useEffect } from "react";
import { Instance } from "mobx-state-tree";
import { observer } from "mobx-react";
import classNames from "classnames";
import { usePersistentUIStore } from "../../hooks/use-stores";
import { HistoryStatus, TreeManager } from "../../models/history/tree-manager";
import { FirestoreHistoryManager } from "../../models/history/firestore-history-manager";
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
  const { activeNavTab } = usePersistentUIStore();
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

return (
    <div className={playbackComponentClass} data-testid="playback-component">
      {playbackControls}
    </div>
  );
});
PlaybackComponent.displayName = "PlaybackComponent";
