import React from "react";
import Slider from "rc-slider";
import { useUIStore } from "../../hooks/use-stores";

import "./slider.scss";
import classNames from "classnames";

export const SliderComponent: React.FC = () => {
  const { activeNavTab } = useUIStore();
  const sliderComponentClass = (`slider-component themed ${activeNavTab}`);
  const renderMarkerRail = () => {
    return (
      <div className={`marker-rail themed ${activeNavTab}`}>
      </div>
    );
  };
  // const timeHandle:SliderProps["handleRender"] = (node, props) => {
  //   const timeHandleStyle = classNames("slider-handle");
  //   return(
  //     <TimeHandle className={timeHandleStyle}/>
  //   );
  // };
  const renderSliderRail = () => {
    return (
      <div className={`slider-rail themed ${activeNavTab}`}>
        <Slider min={0} max={100} />
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
