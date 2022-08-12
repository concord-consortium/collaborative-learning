import React, { useCallback, useEffect, useRef, useState } from "react";
import Slider from "rc-slider";
import classNames from "classnames";
import { Instance } from "mobx-state-tree";
import { observer } from "mobx-react";
import { useUIStore } from "../../hooks/use-stores";
import { TreeManager } from "../../models/history/tree-manager";
import { PlaybackMarkerToolbar } from "./marker-toolbar";
import Marker from "../../clue/assets/icons/playback/marker.svg";
import PlayButton from "../../clue/assets/icons/playback/play-button.svg";
import PauseButton from "../../clue/assets/icons/playback/pause-button.svg";

import "./playback-control.scss";

export interface IMarkerProps {
  id: number;
  location: number;
}

interface IProps {
  treeManager: Instance<typeof TreeManager>;
}

export const PlaybackControlComponent: React.FC<IProps> = observer((props: IProps) => {
  const { treeManager } = props;
  const { activeNavTab } = useUIStore();
  const [sliderPlaying, setSliderPlaying] = useState(false);
  const sliderContainerRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const [markerSelected, setMarkerSelected] = useState(false);
  const [addMarkerButtonSelected, setAddMarkerButtonSelected] = useState(false);
  const [sliderValue, setSliderValue] = useState(100);
  const [markers, setMarkers] = useState<IMarkerProps[]>([]);
  const [selectedMarkers, ] = useState<IMarkerProps[]>([]);
  const history = treeManager.document.history;
  const maxValue = history.length > 0 ? history.length : 0;
  const eventAtCurrentIndex = treeManager.currentHistoryIndex === 0
                                ? undefined
                                : treeManager.getHistoryEntry(treeManager.currentHistoryIndex - 1);
  const eventCreatedTime = eventAtCurrentIndex?.created;
  const playbackDisabled = treeManager.currentHistoryIndex === undefined || sliderValue === maxValue;

  const handlePlayPauseToggle = useCallback((playing?: boolean) => {
                                  if (playing) {
                                    setSliderPlaying(playing);
                                  } else {
                                    setSliderPlaying(!sliderPlaying);
                                  }
                                },[sliderPlaying]);
  useEffect(() => {
    if (sliderPlaying) {
      const slider = setInterval(()=>{
        if (sliderValue <= maxValue) {
          setSliderValue(sliderValue + 1);
          treeManager.goToHistoryEntry(sliderValue)
            .then(()=>{
              treeManager.setCurrentHistoryIndex(sliderValue);
            });
        } else {
          handlePlayPauseToggle(false);
        }
      }, 1000);
      return () => clearInterval(slider);
    }
  }, [handlePlayPauseToggle, history.length, maxValue, sliderPlaying, sliderValue, treeManager]);


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
    setSliderValue(value);
    treeManager.goToHistoryEntry(value)
      .then(()=>{
        treeManager.setCurrentHistoryIndex(value);
      });
  };

  const handleAddMarker = (value: any) => {
    addMarkerButtonSelected && addMarker(value);
  };

  const renderTimeInfo = () => {
    const monthMap: Record<number,string> = {0: "Jan", 1: "Feb", 2: "Mar", 3: "Apr", 4: "May", 5: "Jun",
                      6: "Jul", 7: "Aug", 8: "Sep", 9: "Oct", 10: "Nov", 11: "Dec"};
    const date = eventCreatedTime;
    const month = date?.getMonth();
    const monthStr = month && monthMap[month];
    const dateDay = date?.getDate();
    const year = date?.getFullYear();
    let hours = date?.getHours();
    const minutes = date?.getMinutes();
    const ampm = hours && hours >= 12 ? 'pm' : 'am';
    hours = hours && hours % 12;
    hours = date ? hours : 12; // the hour '0' should be '12'
    const minutesStr = minutes && minutes < 10 ? "0" + minutes : minutes;
    const strTime = date ? hours + ":" + minutesStr + " " + ampm : "";

    return (
      <div className={"time-info"}>
        <div className={"date-info"}>{monthStr} {dateDay}, {year}</div>
        <div className={"time-info"}>{strTime}</div>
      </div>
    );
  };

  const renderMarkerComponent = () => {
    return (
      <div className={`marker-component ${activeNavTab}`} onClick={handleAddMarker} />
    );
  };

  const renderPlayPauseButton = () => {
    const playButtonStyle = classNames("play-button", "themed", activeNavTab, {"disabled" : playbackDisabled});
    const pauseButtonStyle = classNames("pause-button", "themed", activeNavTab, {"playing" : sliderPlaying});
    if (sliderPlaying) {
      return <PauseButton className={pauseButtonStyle} onClick={()=>handlePlayPauseToggle()}/>;
    } else {
      return <PlayButton className={playButtonStyle} onClick={()=>handlePlayPauseToggle()}/>;
    }
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
          <Slider min={0} max={maxValue} step={1} value={sliderValue} ref={railRef}
                  className={`${activeNavTab}`} onChange={handleSliderValueChange} />
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

  const playbackControlsClass = classNames("playback-controls", activeNavTab, {"disabled" : false});
  const sliderComponentClass = classNames(`slider-component ${activeNavTab}`);

  return (
    <div className={playbackControlsClass}>
      <div className={`control-separator ${activeNavTab}`}/>
      {renderPlayPauseButton()}
      <PlaybackMarkerToolbar selectedMarkers={selectedMarkers} markerSelected={markerSelected}
      addMarkerSelected={addMarkerButtonSelected} onAddMarkerSelected={handleAddMarkerButtonSelected}/>
      <div className={sliderComponentClass}>
        {renderMarkerComponent()}
        {renderSliderContainer()}
      </div>
      {renderTimeInfo()}
    </div>
  );
});
PlaybackControlComponent.displayName = "PlaybackControlComponent";


