import React from "react";
import TimeThumbnail from "../../clue/assets/icons/playback/time-thumb.svg";

import "./slider.scss";

export const SliderComponent: React.FC = () => {
  const sliderComponentClass = ("slider-component");
  const renderMarkerRail = () => {
    return (
      <div className={"marker-rail"}>
      </div>
    );
  };
  const renderSliderRail = () => {
    return (
      <div className={"slider-rail"}>
        <div className={"slider-track"} />
        {/* <div className={"slider-handle"}>
          <TimeThumbnail />
        </div> */}
      </div>
    );
  };

  return (
    <div className={sliderComponentClass}>
      {renderMarkerRail()}
      {renderSliderRail()}
    </div>
  );
};
