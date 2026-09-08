import React, { useEffect, useRef, useState } from "react";
import Slider from "rc-slider";
import classNames from "classnames";
import { Instance } from "mobx-state-tree";
import { observer } from "mobx-react";
import { usePersistentUIStore, useStores } from "../../hooks/use-stores";
import { logCurrentHistoryEvent } from "../../models/history/log-history-event";
import { TreeManager } from "../../models/history/tree-manager";
import Marker from "../../clue/assets/icons/playback/marker.svg";
import PlayButton from "../../clue/assets/icons/playback/play-button.svg";
import PauseButton from "../../clue/assets/icons/playback/pause-button.svg";
import { useDocumentComments, useDocumentCommentsAtSimplifiedPath } from "../../hooks/document-comment-hooks";
import { useNavTabPanelInfo } from "../../hooks/use-nav-tab-panel-info";
import { CommentMarker } from "./comment-marker";
import { PlaybackControlModel } from "./playback-control-model";

import "./playback-control.scss";

export interface IMarkerProps {
  id: number;
  location: number;
}

interface IProps {
  treeManager: Instance<typeof TreeManager>;
  // Set when a link asked for a particular entry of this document. The document is about to
  // be sent there, so the reader is not following the end of its history.
  requestedHistoryId: string | undefined;
}

export const PlaybackControlComponent: React.FC<IProps> = observer((props: IProps) => {
  const { treeManager, requestedHistoryId } = props;
  const { focusDocument } = usePersistentUIStore();
  const { user, displayedActiveNavTab: activeNavTab } = useStores();
  const { setPlaybackTime } = useNavTabPanelInfo();
  const sliderContainerRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const [markerSelected, setMarkerSelected] = useState(false);
  const [addMarkerButtonSelected, /* setAddMarkerButtonSelected */] = useState(false);
  const [markers, setMarkers] = useState<IMarkerProps[]>([]);

  const [model] = useState(() =>
    new PlaybackControlModel(treeManager, requestedHistoryId ? undefined : "end"));
  useEffect(() => () => model.dispose(), [model]);

  // The chat panel filters itself to the moment on screen. Deriving that from the current
  // stop covers every way the document can move, including seeks the slider did not start.
  // Keying the effect on the millisecond keeps an equal-but-new Date from looping.
  const playbackTimeMs = model.sliderStopTime?.getTime();
  useEffect(() => {
    setPlaybackTime(playbackTimeMs === undefined ? undefined : new Date(playbackTimeMs));
  }, [setPlaybackTime, playbackTimeMs]);

  // Closing playback should stop the chat panel filtering by whatever moment was last shown.
  useEffect(() => () => setPlaybackTime(undefined), [setPlaybackTime]);

  // The comments come from Firestore queries, which are React Query hooks and so have to be
  // called from the component. The model is told about their results.
  const { data: comments } = useDocumentComments(focusDocument);
  const { data: simplePathComments } = useDocumentCommentsAtSimplifiedPath(focusDocument);
  useEffect(() => {
    model.setComments(comments, simplePathComments);
  }, [model, comments, simplePathComments]);

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

  // const handleAddMarkerButtonSelected = () => {
  //   setAddMarkerButtonSelected(!addMarkerButtonSelected);
  // };

  const handleSliderValueChange = (value: any) => {
    void model.goToSliderStop(value);
  };

  const handleSliderAfterChange = (value: any) => {
    logCurrentHistoryEvent(treeManager, "playSeek");
  };

  const handleAddMarker = (value: any) => {
    addMarkerButtonSelected && addMarker(value);
  };

  const renderTimeInfo = () => {
    const monthMap: Record<number,string> = {0: "Jan", 1: "Feb", 2: "Mar", 3: "Apr", 4: "May", 5: "Jun",
                      6: "Jul", 7: "Aug", 8: "Sep", 9: "Oct", 10: "Nov", 11: "Dec"};
    // The initial stop describes no change, so the readout stays empty there.
    const date = model.sliderStopTime;
    let strDate = "";
    let strTime = "";
    if (date) {
      strDate = `${monthMap[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
      const ampm = date.getHours() >= 12 ? 'pm' : 'am';
      const hours = date.getHours() % 12 || 12; // the hour '0' should be '12'
      const minutes = date.getMinutes();
      const minutesStr = minutes < 10 ? "0" + minutes : minutes;
      strTime = `${hours}:${minutesStr} ${ampm}`;
    }

    const historyIndex = model.sliderStopHistoryIndex;

    return (
      <div className={"time-info"} data-testid="playback-time-info">
        <div className={"date-info"}>{strDate}</div>
        <div className={"time-info"}>{strTime} {historyIndex !== undefined && `(${historyIndex})`}</div>
      </div>
    );
  };

  const renderMarkerComponent = () => {
    return (
      <div className={`marker-component ${activeNavTab}`} onClick={handleAddMarker} />
    );
  };

  const renderPlayPauseButton = () => {
    const playButtonStyle = classNames("play-button", "themed", activeNavTab,
                                       {"disabled" : model.playbackDisabled});
    const pauseButtonStyle = classNames("pause-button", "themed", activeNavTab,
                                        {"playing" : model.sliderPlaying});
    if (model.sliderPlaying) {
      return <PauseButton className={pauseButtonStyle} onClick={()=>model.togglePlay()}
                data-testid="playback-pause-button" />;
    } else {
      return <PlayButton className={playButtonStyle} onClick={()=>model.togglePlay()}
                data-testid="playback-play-button" />;
    }
  };

  const getMarkerLocation = (location: number) => {
    const sliderComponentWidth = sliderContainerRef.current?.offsetWidth;
    if (sliderComponentWidth) {
      const markerOffset = ((location * (sliderComponentWidth - 20))/sliderComponentWidth);
      return (markerOffset);
    }
  };

  const renderSliderContainer = () => {
    const markerContainerClass = classNames("marker-container", activeNavTab, {"selected": markerSelected});
    const markerClass = classNames("marker", activeNavTab);

    return (
      <>
        <div className="slider-container" ref={sliderContainerRef} data-testid="playback-slider">
          <Slider
            min={0}
            max={model.lastStopIndex}
            step={1}
            value={model.sliderValue}
            ref={railRef}
            className={`${activeNavTab}`}
            onChange={handleSliderValueChange}
            onAfterChange={handleSliderAfterChange}
          />
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
        })}
      </>
    );
  };

  const renderCommentMarkers = () => {
    return (
      <div className="comment-markers-container" data-testid="comment-markers">
        {
          model.allComments.map(comment => {
            return <CommentMarker
              key={comment.id}
              isMe={comment.uid === user?.id}
              comment={comment}
              commentLocation={model.getCommentLocation(comment)}
              activeNavTab={activeNavTab}
              onClick={model.goToComment}
            />;
          })
        }
      </div>
    );
  };

  const renderPlaybackFailureMarkers = () => {
    const failureMarkers = model.uniqueFailures;
    if (failureMarkers.length === 0) return null;

    const selectedFailure = model.selectedFailure;
    return (
      <div className="playback-failure-markers-container" data-testid="playback-failure-markers">
        {failureMarkers.map(({ failure, location }) => {
          const isSelected = selectedFailure?.historyIndex === failure.historyIndex;
          return (
            <button
              key={`corrupt-${failure.historyIndex}`}
              type="button"
              className="playback-failure-marker"
              style={{ left: `calc(${location}% - 5px)` }}
              aria-label={`History playback failure at entry ${failure.historyIndex}`}
              aria-expanded={isSelected}
              onClick={() => model.setSelectedFailure(isSelected ? null : failure)}
            >
              <div className="playback-failure-marker-line" />
              <div className="playback-failure-marker-icon">!</div>
            </button>
          );
        })}
        {selectedFailure && (
          <div className="playback-failure-detail" data-testid="playback-failure-detail" role="dialog"
              aria-label="History playback failure details">
            <div className="playback-failure-detail-header">
              <span>History Playback Failure</span>
              <button
                type="button"
                className="playback-failure-detail-close"
                aria-label="Close failure details"
                onClick={() => model.setSelectedFailure(null)}
              >
                ×
              </button>
            </div>
            <div className="playback-failure-detail-body">
              <div><strong>Entry:</strong> {selectedFailure.historyIndex}</div>
              <div><strong>Direction:</strong> {selectedFailure.direction}</div>
              <div><strong>Model:</strong> {selectedFailure.historyEntry.model ?? "unknown"}</div>
              <div><strong>Action:</strong> {selectedFailure.historyEntry.action ?? "unknown"}</div>
              <div><strong>Error:</strong> {selectedFailure.errorMessage}</div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const playbackControlsClass = classNames("playback-controls", activeNavTab, {"disabled" : false});
  const sliderComponentClass = classNames(`slider-component ${activeNavTab}`);

  return (
    <div className={playbackControlsClass}>
      {renderPlayPauseButton()}
      {/* <PlaybackMarkerToolbar selectedMarkers={selectedMarkers} markerSelected={markerSelected}
          addMarkerSelected={addMarkerButtonSelected} onAddMarkerSelected={handleAddMarkerButtonSelected}/> */}
      <div className={sliderComponentClass}>
        {renderMarkerComponent()}
        {renderCommentMarkers()}
        {renderPlaybackFailureMarkers()}
        {renderSliderContainer()}
      </div>
      {renderTimeInfo()}
      {model.playbackFailureWarning && !model.selectedFailure &&
        <div className="playback-failure-warning" data-testid="playback-failure-warning">
          {model.playbackFailureWarning}
        </div>
      }
    </div>
  );
});
PlaybackControlComponent.displayName = "PlaybackControlComponent";
