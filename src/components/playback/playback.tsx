import React, { useState } from "react";
import classNames from "classnames";
import { useUIStore } from "../../hooks/use-stores";
import { SliderComponent } from "./slider";
import PlaybackIcon from "../../clue/assets/icons/playback/playback-icon.svg";
import PlayButton from "../../clue/assets/icons/playback/play-button.svg";
import PauseButton from "../../clue/assets/icons/playback/pause-button.svg";

import "./playback.scss";

export const PlaybackComponent: React.FC = () => {
  const { activeNavTab } = useUIStore();
  const [showPlaybackControls, setShowPlaybackControls] = useState(false);
  const [sliderPlaying, setSliderPlaying] = useState(false);

  const handleTogglePlaybackControlComponent = () => {
    setShowPlaybackControls(!showPlaybackControls);
  };
  const handlePlayPauseToggle = () => {
    setSliderPlaying(!sliderPlaying);
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

  const renderPlayPauseButton = () => {
    const playButtonStyle = classNames("play-button", "themed", activeNavTab, {"disabled" : false});
    const pauseButtonStyle = classNames("pause-button", "themed", activeNavTab, {"playing" : sliderPlaying});
    if (sliderPlaying) {
      return <PauseButton className={pauseButtonStyle} onClick={handlePlayPauseToggle}/>;
    } else {
      return <PlayButton className={playButtonStyle} onClick={handlePlayPauseToggle}/>;
    }
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
// TODO: play button is disabled because user is already at the end
//       moving time handle enables play button

    return (
      <div className={playbackControlsClass}>
        <div className={`control-separator ${activeNavTab}`}/>
        {renderPlayPauseButton()}
        <SliderComponent sliderPlaying={sliderPlaying} onTogglePlayPause={handlePlayPauseToggle}/>
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
