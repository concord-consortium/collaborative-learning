import React from "react";
import { Instance } from "mobx-state-tree";
import { observer } from "mobx-react";
import classNames from "classnames";
import { useUIStore } from "../../hooks/use-stores";
import { HistoryStatus, TreeManager } from "../../models/history//tree-manager";
import { DocumentModelType } from "../../models/document/document";
import { PlaybackControlComponent } from "./playback-control";
import PlaybackIcon from "../../clue/assets/icons/playback/playback-icon.svg";

import "./playback.scss";

interface IProps {
  document: DocumentModelType | undefined;
  showPlaybackControls: boolean | undefined;
  onTogglePlaybackControls: (() => void) | undefined;
}

export const PlaybackComponent: React.FC<IProps> = observer((props: IProps) => {
  const { document, showPlaybackControls, onTogglePlaybackControls  } = props;
  const { activeNavTab } = useUIStore();
  const treeManager = document?.treeManagerAPI as Instance<typeof TreeManager>;

  const renderPlaybackToolbarButton = () => {
    const playbackToolbarButtonComponentStyle =
      classNames("playback-toolbar-button-component", { "disabled" : false },
                  { "show-control": showPlaybackControls });
    const playbackToolbarButtonStyle =
      classNames("playback-toolbar-button", "themed", activeNavTab,
                { "show-control": showPlaybackControls });
    return (
      <div className={playbackToolbarButtonComponentStyle} onClick={onTogglePlaybackControls}
          data-testid="playback-component-button">
        <PlaybackIcon className={playbackToolbarButtonStyle}/>
      </div>
    );
  };

  const disablePlayback = false;
  const playbackComponentClass = classNames("playback-component", activeNavTab,
                                            { "show-control" : showPlaybackControls,
                                              "disabled" : disablePlayback });

  let playbackControls = null;
  if (showPlaybackControls) {
    playbackControls = treeManager.historyStatus === HistoryStatus.HISTORY_LOADED 
      ? <PlaybackControlComponent treeManager={treeManager} />
      : <div className="playback-controls loading">
          {treeManager.historyStatusString}
        </div>;
  }
  return (
    <div className={playbackComponentClass} data-testid="playback-component">
      {renderPlaybackToolbarButton()}
      {playbackControls}
    </div>
  );
});
PlaybackComponent.displayName = "PlaybackComponent";

