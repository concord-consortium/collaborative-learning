import React, { useState } from "react";
import classNames from "classnames";
import { SliderComponent } from "./slider";
import PlaybackIcon from "../../clue/assets/icons/playback/playback-icon.svg";
import PlayButton from "../../clue/assets/icons/playback/play-button.svg";

import "./playback.scss";
import { useUIStore } from "../../hooks/use-stores";

export const PlaybackComponent: React.FC = () => {
  const { activeNavTab } = useUIStore();
  const [showPlaybackControls, setShowPlaybackControls] = useState(false);
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

  const renderPlayButton = () => {
    const playButtonStyle = classNames("play-button", "themed", activeNavTab, {"disabled" : false});
    return (
      <PlayButton className={playButtonStyle}/>
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
    const playbackControlsClass = classNames("playback-controls", activeNavTab);

    return (
      <div className={playbackControlsClass}>
        <div className={`control-separator ${activeNavTab}`}/>
        {renderPlayButton()}
        <SliderComponent />
        {renderTimeInfo()}
      </div>
    );
  };

  const playbackComponentClass = classNames("playback-component", activeNavTab,
                                            {"show-control" : showPlaybackControls});

  return (
    <div className={playbackComponentClass}>
      {renderPlaybackToolbarButton()}
      {showPlaybackControls && renderPlaybackControls()}
    </div>
  );
};
