import React, { useState } from "react";
import classNames from "classnames";
import { SliderComponent } from "./slider";
import PlaybackIcon from "../../clue/assets/icons/playback/playback-icon.svg";
import PlayButton from "../../clue/assets/icons/playback/play-button.svg";

import "./playback.scss";
import { useUIStore } from "../../hooks/use-stores";

// interface IProps {
//   navTab: NavTabSpec; //need the tab to know which color to use
// }

export const PlaybackComponent: React.FC = () => {
  const { activeNavTab } = useUIStore();
  const [showPlaybackControls, setShowPlaybackControls] = useState(false);
  const handleTogglePlaybackControlComponent = () => {
    setShowPlaybackControls(!showPlaybackControls);
  };
  const renderPlaybackToolbarButton = () => {
    const playbackToolbarButtonComponentStyle =
      classNames("playback-toolbar-button-component", "themed", activeNavTab, {"disabled" : false},
                  {"show-control": showPlaybackControls});
    const playbackToolbarButtonContainerStyle =
      classNames("playback-toolbar-button-container", "themed", activeNavTab,
                {"show-control": showPlaybackControls});
    const playbackToolbarButtonStyle =
      classNames("playback-toolbar-button", "themed", activeNavTab,
                {"show-control": showPlaybackControls});
    return (
      <>
        <div className={playbackToolbarButtonComponentStyle} onClick={handleTogglePlaybackControlComponent}>
          <div className={playbackToolbarButtonContainerStyle}>
            <PlaybackIcon className={playbackToolbarButtonStyle}/>
          </div>
        </div>
        {showPlaybackControls && <div className={`canvas-separator ${activeNavTab}`}/>}
      </>
    );
  };

  const renderPlayButton = () => {
    return (
      <div className={`play-button themed ${activeNavTab}`}>
        <PlayButton className={`themed ${activeNavTab}`}/>
      </div>
    );
  };

  const renderTimeInfo = () => {
    return (
      <div className={"time-info"}>
        <div className={"date-info"}>Nov. 25, 2022</div>
        <div className={"time-info"}>12:55 AM</div>
      </div>
    );
  };

  const renderPlaybackControls = () => {
    const playbackControlsClass = classNames("playback-controls", "themed", activeNavTab);

    return (
      <div className={playbackControlsClass}>
        {renderPlayButton()}
        <SliderComponent />
        {renderTimeInfo()}
      </div>
    );
  };

  const playbackComponentClass = classNames("playback-component", "themed", activeNavTab,
                                            {"show-control" : showPlaybackControls});

  return (
    <div className={playbackComponentClass}>
      {renderPlaybackToolbarButton()}
      {showPlaybackControls && renderPlaybackControls()}
    </div>
  );
};
