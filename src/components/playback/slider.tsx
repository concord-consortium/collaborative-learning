import React from "react";
import Slider from "rc-slider";
import classNames from "classnames";
import { useUIStore } from "../../hooks/use-stores";

import "./slider.scss";

export const SliderComponent: React.FC = () => {
  const { activeNavTab } = useUIStore();
  const sliderComponentClass = classNames(`slider-component ${activeNavTab}`);

  const renderMarkerRail = () => {
    return (
      <div className={`marker-rail ${activeNavTab}`}>
      </div>
    );
  };

  const renderSliderRail = () => {
    return (
      <div className="slider-rail">
        <Slider min={0} max={100} className={`${activeNavTab}`} />
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
