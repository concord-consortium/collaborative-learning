import React, { useState } from "react";
import { Instance } from "mobx-state-tree";
import { observer } from "mobx-react";
import classNames from "classnames";
import { useDocumentFromStore, useUIStore } from "../../hooks/use-stores";
import { TreeManager } from "../../models/history//tree-manager";
import { PlaybackControlComponent } from "./playback-control";
import PlaybackIcon from "../../clue/assets/icons/playback/playback-icon.svg";

import "./playback.scss";

interface IProps {
  documentId: string | undefined;
}

export const PlaybackComponent: React.FC<IProps> = observer((props: IProps) => {
  const { documentId } = props;
  const { activeNavTab } = useUIStore();
  const [showPlaybackControls, setShowPlaybackControls] = useState(false);
  const document = useDocumentFromStore(documentId);
  const treeManager = document?.treeManagerAPI as Instance<typeof TreeManager>;
  const history = treeManager?.document.history;

  const handleTogglePlaybackControlComponent = () => {
    setShowPlaybackControls(!showPlaybackControls);
  };

  const renderPlaybackToolbarButton = () => {
    const playbackToolbarButtonComponentStyle =
      classNames("playback-toolbar-button-component", {"disabled" : false},
                  {"show-control": showPlaybackControls});
    const playbackToolbarButtonStyle =
      classNames("playback-toolbar-button", "themed", activeNavTab,
                {"show-control": showPlaybackControls});
    return (
      <div className={playbackToolbarButtonComponentStyle} onClick={handleTogglePlaybackControlComponent}>
        <PlaybackIcon className={playbackToolbarButtonStyle}/>
      </div>
    );
  };

  const disablePlayback = history.length < 1;
  const playbackComponentClass = classNames("playback-component", activeNavTab,
                                            {"show-control" : showPlaybackControls,
                                              "disabled" : disablePlayback});
  return (
    <div className={playbackComponentClass}>
      {renderPlaybackToolbarButton()}
      {showPlaybackControls && <PlaybackControlComponent treeManager={treeManager} />}
    </div>
  );
});
PlaybackComponent.displayName = "PlaybackComponent";

