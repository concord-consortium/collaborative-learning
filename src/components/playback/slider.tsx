import React from "react";

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
