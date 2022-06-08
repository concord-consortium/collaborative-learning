import React, { useState } from "react";
import classNames from "classnames";
import { NavTabSpec } from "../../models/view/nav-tabs";
import { SliderComponent } from "./slider";
import PlaybackIcon from "../../clue/assets/icons/playback/playback-icon.svg";
import PlayButton from "../../clue/assets/icons/playback/play-button.svg";

import "./playback.scss";

// interface IProps {
//   navTab: NavTabSpec; //need the tab to know which color to use
// }

export const PlaybackComponent: React.FC = () => {
  const [showPlaybackControls, setShowPlaybackControls] = useState(false);
  const handleTogglePlaybackControlComponent = () => {
    setShowPlaybackControls(!showPlaybackControls);
  };
  const renderPlaybackToolbarButton = () => {
    const playbackToolbarButtonComponentStyle =
      classNames("playback-toolbar-button-component", {"disabled" : false}, {"show-control": showPlaybackControls});
    return (
      <>
        <div className={playbackToolbarButtonComponentStyle} onClick={handleTogglePlaybackControlComponent}>
          <div className={"playback-toolbar-button-container"}>
            <PlaybackIcon className={"playback-toolbar-button"}/>
          </div>
        </div>
        {showPlaybackControls && <div className="canvas-separator"/>}
      </>
    );
  };
  const renderPlayButton = () => {
    return (
      <div className={"play-button"}>
        <PlayButton />
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
    const playbackControlsClass = classNames("playback-controls");

    return (
      <div className={playbackControlsClass}>
        {renderPlayButton()}
        <SliderComponent />
        {renderTimeInfo()}
      </div>
    );
  };

  return (
    <div className="playback-component">
      {renderPlaybackToolbarButton()}
      {showPlaybackControls && renderPlaybackControls()}
    </div>
  );


};
