import React from "react";
import { Instance } from "mobx-state-tree";
import { observer } from "mobx-react";
import classNames from "classnames";
import { useUIStore } from "../../hooks/use-stores";
import { TreeManager } from "../../models/history//tree-manager";
import { DocumentModelType } from "../../models/document/document";
import { LoadDocumentHistory } from "./load-document-history";
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
  // FIXME-HISTORY: hack for always enabling playback. Story to fix this:
  // https://www.pivotaltracker.com/story/show/183291329
  //
  // const history = treeManager?.document.history;

  const renderPlaybackToolbarButton = () => {
    const playbackToolbarButtonComponentStyle =
      classNames("playback-toolbar-button-component", {"disabled" : false},
                  {"show-control": showPlaybackControls});
    const playbackToolbarButtonStyle =
      classNames("playback-toolbar-button", "themed", activeNavTab,
                {"show-control": showPlaybackControls});
    return (
      <div className={playbackToolbarButtonComponentStyle} onClick={onTogglePlaybackControls}
          data-testid="playback-component-button">
        <PlaybackIcon className={playbackToolbarButtonStyle}/>
      </div>
    );
  };

  // This should delay showing the playback controls until the history is actually
  // loaded into documentToShow
  const historyLength = treeManager.document.history.length;

  const actuallyShowPlaybackControls = showPlaybackControls && (historyLength !== undefined) && (historyLength > 0);

  // const disablePlayback = history.length < 1;

  // FIXME-HISTORY: HACK for now always enable playback so we can use the
  // opening of the playback to trigger the load of the history.  Story to fix
  // this: https://www.pivotaltracker.com/story/show/183291329
  const disablePlayback = false;
  const playbackComponentClass = classNames("playback-component", activeNavTab,
                                            {"show-control" : showPlaybackControls,
                                              "disabled" : disablePlayback});
  return (
    <div className={playbackComponentClass} data-testid="playback-component">
      {renderPlaybackToolbarButton()}
      {actuallyShowPlaybackControls
        // If we've found history, display the playback control
        ? <PlaybackControlComponent treeManager={treeManager} />
        : showPlaybackControls
        // If we're loading the history or couldn't find any, display the loading component
        ? <LoadDocumentHistory document={document} />
        : ''}
    </div>
  );
});
PlaybackComponent.displayName = "PlaybackComponent";

