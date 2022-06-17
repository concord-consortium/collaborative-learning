import React, { useRef, useState } from "react";
import Slider from "rc-slider";
import classNames from "classnames";
import { useUIStore } from "../../hooks/use-stores";
import { PlaybackMarkerToolbar } from "./marker-toolbar";
import Marker from "../../clue/assets/icons/playback/marker.svg";

import "./slider.scss";

export interface IMarkerProps {
  id: number;
  location: number;
}

interface IProps {
  sliderPlaying: boolean;
  onTogglePlayPause: () => void;
}

export const SliderComponent: React.FC<IProps> = (props) => {
  const { activeNavTab } = useUIStore();
  const sliderContainerRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const [markerSelected, setMarkerSelected] = useState(false);
  const [addMarkerButtonSelected, setAddMarkerButtonSelected] = useState(false);
  const [markers, setMarkers] = useState<IMarkerProps[]>([]);
  const [selectedMarkers, setSelectedMarkers] = useState<IMarkerProps[]>([]);

  //TODO: need to add a modal that warns users about max number of markers. Currently, a generic alert is shown
  //TODO: Currently, if add marker is on and user moves the time handle, a marker is added where the user
  // drops the handle. It shouldn't do that. Marker should only be added when user clicks on the rail or the time thumb.
  // TODO: Marker toolbar should be hidden until thumbnail is focused.
  //        Currently, toolbar appears when user opens playback.
  const addMarker = (value: any) => {
    if (markers.length >= 9) {
      alert("You already have 9 markers. Please delete some markers to add more.");
    } else {
      setMarkers([...markers, {id: markers.length+1, location: value}]);
    }
  };

  //TODO: need to track which marker is selected. Currently, all markers in a document will appear selected.
  const handleMarkerSelected = (e:  React.MouseEvent) => {
    setMarkerSelected(!markerSelected);
  };

  const handleAddMarkerButtonSelected = () => {
    setAddMarkerButtonSelected(!addMarkerButtonSelected);
  };

  const handleSliderValueChange = (value: any) => {
    addMarkerButtonSelected && addMarker(value);
  };

  const renderMarkerComponent = () => {
    return (
      <div className={`marker-component ${activeNavTab}`} />
    );
  };

  const renderSliderContainer = () => {
    const markerContainerClass = classNames("marker-container", activeNavTab, {"selected": markerSelected});
    const markerClass = classNames("marker", activeNavTab);

    const getMarkerLocation = (location: number) => {
      const sliderComponentWidth = sliderContainerRef.current?.offsetWidth;
      if (sliderComponentWidth) {
        const markerOffset = ((location * (sliderComponentWidth - 20))/sliderComponentWidth);
        return (markerOffset);
      }
    };

    return (
      <>
        <div className="slider-container" ref={sliderContainerRef}>
          <Slider min={0} max={100} step={1} defaultValue={100} ref={railRef}
                  className={`${activeNavTab}`} onAfterChange={handleSliderValueChange} />
        </div>
        { markers.map(marker => {
          const markerLocation = getMarkerLocation(marker.location);
          const markerStyle = {left: `${markerLocation}%`};
          return (
            <div key={`marker-${marker.id}`} className={markerContainerClass} style={markerStyle}
                onClick={handleMarkerSelected}>
              <span className="marker-id">{marker.id}</span>
              <Marker className={markerClass}/>
            </div>
          );
        })
      }
      </>
    );
  };

  const sliderComponentClass = classNames(`slider-component ${activeNavTab}`);

  return (
    <>
      <PlaybackMarkerToolbar selectedMarkers={selectedMarkers} markerSelected={markerSelected}
          addMarkerSelected={addMarkerButtonSelected} onAddMarkerSelected={handleAddMarkerButtonSelected}/>
      <div className={sliderComponentClass}>
        {renderMarkerComponent()}
        {renderSliderContainer()}
      </div>
    </>
  );
};
