import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Slider from "rc-slider";
import classNames from "classnames";
import { Instance } from "mobx-state-tree";
import { observer } from "mobx-react";
import { usePersistentUIStore } from "../../hooks/use-stores";
import { logCurrentHistoryEvent } from "../../models/history/log-history-event";
import { TreeManager } from "../../models/history/tree-manager";
import Marker from "../../clue/assets/icons/playback/marker.svg";
import PlayButton from "../../clue/assets/icons/playback/play-button.svg";
import PauseButton from "../../clue/assets/icons/playback/pause-button.svg";
import { useDocumentComments, useDocumentCommentsAtSimplifiedPath } from "../../hooks/document-comment-hooks";
import { WithId } from "../../hooks/firestore-hooks";
import { CommentDocument } from "../../lib/firestore-schema";
import { useNavTabPanelInfo } from "../../hooks/use-nav-tab-panel-info";
import { HistoryEntryType } from "../../models/history/history";
import { CommentMarker } from "./comment-marker";

import "./playback-control.scss";

export interface IMarkerProps {
  id: number;
  location: number;
}

interface IHistorySliderEntry {
  kind: "history";
  entry: HistoryEntryType;
  index: number;
  created: Date;
}
export interface ICommentSliderEntry {
  kind: "comment";
  entry: WithId<CommentDocument>;
  created: Date;
}
type ISliderEntry = IHistorySliderEntry | ICommentSliderEntry;

interface IProps {
  treeManager: Instance<typeof TreeManager>;
}

export const PlaybackControlComponent: React.FC<IProps> = observer((props: IProps) => {
  const { treeManager } = props;
  const { activeNavTab, focusDocument } = usePersistentUIStore();
  const [sliderPlaying, setSliderPlaying] = useState(false);
  const sliderContainerRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const [markerSelected, setMarkerSelected] = useState(false);
  const [addMarkerButtonSelected, /* setAddMarkerButtonSelected */] = useState(false);
  const [markers, setMarkers] = useState<IMarkerProps[]>([]);
  const { data: comments } = useDocumentComments(focusDocument);
  const { data: simplePathComments } = useDocumentCommentsAtSimplifiedPath(focusDocument);
  const allComments = [...comments||[], ...simplePathComments||[]]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const { setPlaybackTime } = useNavTabPanelInfo();

  // const [selectedMarkers, ] = useState<IMarkerProps[]>([]);
  const history = treeManager.document.history;

  // The numHistoryEntriesApplied should be set to the position of the history entry
  // that last "modified" the current document.
  //
  // Ideally the document would have some field that indicated its "history" id
  // So that way we can figure out which history event we need to be on based on
  // this history id. Documents do have something like this which is being ignored
  // by the history stuff, but it is being used to trigger document saves to Firebase
  // I think.  In some sense this is like a hash of the document content.

  const {numHistoryEventsApplied} = treeManager;
  // numHistoryEventsApplied can be 0 or undefined, the event is undefined in both cases

  const sliderEntries = useMemo(() => {
    let entries: ISliderEntry[] = history
      .map((entry, index) => ({kind: "history", entry, created: entry.created, index}));
    entries = entries.concat(allComments.map((comment) => (
      {kind: "comment", entry: comment, created: comment.createdAt}))
    );
    entries.sort((a, b) => a.created.getTime() - b.created.getTime());
    return entries;
  }, [history, allComments]);

  const [sliderValue, setSliderValue] = useState(() => sliderEntries.length);

  const eventCreatedTime = useMemo(() => {
    const entry = sliderEntries[sliderValue] ?? sliderEntries[sliderEntries.length - 1];
    return entry?.created;
  }, [sliderValue, sliderEntries]);

  const playbackDisabled = numHistoryEventsApplied === undefined || sliderValue === sliderEntries.length;

  const handlePlayPauseToggle = useCallback((playing?: boolean) => {
    const playStatus = playing !== undefined ? playing : !sliderPlaying;
    logCurrentHistoryEvent(treeManager, playStatus ? "playStart" : "playStop");
    setSliderPlaying(playStatus);
  }, [sliderPlaying, treeManager]);

  const goToSliderValue = useCallback((value: number) => {
    // the slider max is sliderEntries.length, which is one more than the last index
    // in sliderEntries. This value indicates going to the end of the history.
    const sliderEntry = sliderEntries[value];
    if (sliderEntry) {
      setPlaybackTime(sliderEntry.created);
      if (sliderEntry.kind === "history") {
        treeManager.goToHistoryEntry(sliderEntry.index);
      }
    } else {
      // go to the final history entry when at the end of the slider
      treeManager.goToHistoryEntry(history.length);
    }
    setSliderValue(value);
  }, [treeManager, history, sliderEntries, setPlaybackTime]);

  const goToComment = useCallback((comment: WithId<CommentDocument>) => {
    const index = sliderEntries.findIndex(e => e.kind === "comment" && e.entry.id === comment.id);
    if (index !== -1) {
      goToSliderValue(index);
    }
  }, [sliderEntries, goToSliderValue]);

  useEffect(() => {
    if (sliderPlaying) {
      const slider = setTimeout(()=>{
        if (sliderValue < sliderEntries.length) {
          goToSliderValue(sliderValue + 1);
        } else {
          handlePlayPauseToggle(false);
        }
      }, 500);
      return () => clearTimeout(slider);
    }
  }, [handlePlayPauseToggle, sliderEntries.length, sliderPlaying, sliderValue, goToSliderValue]);

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
    goToSliderValue(value);
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
    const date = eventCreatedTime;
    const month = date?.getMonth();
    const monthStr = month !== undefined ? monthMap[month] : "";
    const dateDay = date?.getDate();
    const year = date?.getFullYear();
    let hours = date?.getHours() ?? 0;
    const minutes = date?.getMinutes() ?? 0;
    const ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12;
    hours = date && (hours !== 0) ? hours : 12; // the hour '0' should be '12'
    const minutesStr = minutes < 10 ? "0" + minutes : minutes;
    const strTime = date ? hours + ":" + minutesStr + " " + ampm : "";

    return (
      <div className={"time-info"} data-testid="playback-time-info">
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
      return <PauseButton className={pauseButtonStyle} onClick={()=>handlePlayPauseToggle()}
                data-testid="playback-pause-button" />;
    } else {
      return <PlayButton className={playButtonStyle} onClick={()=>handlePlayPauseToggle()}
                data-testid="playback-play-button" />;
    }
  };

  const getCommentLocation = (comment: WithId<CommentDocument>) => {
    if (sliderEntries.length === 0) {
      return 0;
    }

    const index = sliderEntries.findIndex(entry => entry.kind === "comment" && entry.entry.id === comment.id);
    return Math.max(0, Math.min(100, 100 * (index / sliderEntries.length)));
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
            max={sliderEntries.length}
            step={1}
            value={sliderValue}
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
          allComments.map(comment => {
            return <CommentMarker
              key={comment.id}
              comment={comment}
              commentLocation={getCommentLocation(comment)}
              activeNavTab={activeNavTab}
              onClick={goToComment}
            />;
          })
        }
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
        {renderSliderContainer()}
      </div>
      {renderTimeInfo()}
    </div>
  );
});
PlaybackControlComponent.displayName = "PlaybackControlComponent";
