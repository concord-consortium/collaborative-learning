import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Slider from "rc-slider";
import classNames from "classnames";
import { Instance } from "mobx-state-tree";
import { observer } from "mobx-react";
import { usePersistentUIStore, useStores } from "../../hooks/use-stores";
import { logCurrentHistoryEvent } from "../../models/history/log-history-event";
import { HistoryPlaybackFailure, TreeManager } from "../../models/history/tree-manager";
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

// A stop's array index is the slider value that selects it, so the document before any of its
// history was applied needs a stop of its own at index 0. It describes no change, so it has no
// date. This is history position 0, which is where a `studentDocumentHistoryId=first` link
// lands — "first" being the sentinel logDocumentEvent emits for a change made before the
// document had any history entry.
interface IInitialSliderStop {
  kind: "initial";
}
interface IHistorySliderStop {
  kind: "history";
  entry: HistoryEntryType;
  index: number;
  created: Date;
}
export interface ICommentSliderStop {
  kind: "comment";
  entry: WithId<CommentDocument>;
  created: Date;
}
type ISliderStop = IInitialSliderStop | IHistorySliderStop | ICommentSliderStop;

interface IProps {
  treeManager: Instance<typeof TreeManager>;
}

export const PlaybackControlComponent: React.FC<IProps> = observer((props: IProps) => {
  const { treeManager } = props;
  const { focusDocument } = usePersistentUIStore();
  const { user, displayedActiveNavTab: activeNavTab } = useStores();
  const [sliderPlaying, setSliderPlaying] = useState(false);
  const sliderContainerRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const [markerSelected, setMarkerSelected] = useState(false);
  const [addMarkerButtonSelected, /* setAddMarkerButtonSelected */] = useState(false);
  const [markers, setMarkers] = useState<IMarkerProps[]>([]);
  const { data: comments } = useDocumentComments(focusDocument);
  const { data: simplePathComments } = useDocumentCommentsAtSimplifiedPath(focusDocument);
  // Memoized because sliderStops depends on it, and so in turn do goToSliderStop and the
  // auto-play effect. Rebuilt on every render, it would restart auto-play's 500ms timer on
  // every render.
  const allComments = useMemo(
    () => [...comments||[], ...simplePathComments||[]]
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
    [comments, simplePathComments]);
  const { setPlaybackTime } = useNavTabPanelInfo();

  // const [selectedMarkers, ] = useState<IMarkerProps[]>([]);
  const history = treeManager.document.history;
  // An MST array keeps its identity when entries are appended, so `history` alone can never
  // invalidate a memo. Anything derived from the entries has to depend on the length as well,
  // or it will not grow as the document is edited while its history is open. The history is
  // append-only, so the length is enough to notice every change to it.
  const historyLength = history.length;

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

  const sliderStops = useMemo(() => {
    // History entries must stay in index order (their position in the array),
    // not sorted by created time. Created times can be out of order when
    // sub-actions complete before their parent action.
    // Indexed by historyLength rather than mapped over history, so that the entry count is
    // an input to this memo and not just something read from a value that never changes.
    const historyStops: IHistorySliderStop[] = [];
    for (let index = 0; index < historyLength; index++) {
      const entry = history[index];
      historyStops.push({kind: "history", entry, created: entry.created, index});
    }

    // Insert comments at the correct position among history entries based
    // on the comment's created time. Each comment goes after the last
    // history entry whose created time is <= the comment's created time.
    // allComments is already in created order.
    const stops: ISliderStop[] = [{kind: "initial"}];
    let commentIdx = 0;
    for (const historyStop of historyStops) {
      while (commentIdx < allComments.length &&
             allComments[commentIdx].createdAt.getTime() < historyStop.created.getTime()) {
        const comment = allComments[commentIdx];
        stops.push({kind: "comment", entry: comment, created: comment.createdAt});
        commentIdx++;
      }
      stops.push(historyStop);
    }
    while (commentIdx < allComments.length) {
      const comment = allComments[commentIdx];
      stops.push({kind: "comment", entry: comment, created: comment.createdAt});
      commentIdx++;
    }
    return stops;
  }, [history, historyLength, allComments]);

  // A slider stop is a state of the document rather than a change to it. A history position
  // counts applied entries, so position p is the document with entries 0..p-1 applied.
  //
  // A history stop is the document once its entry has been applied. A comment stop takes the
  // position of the entry before it, which is the document its author was looking at. The
  // initial stop is the document before any of the history was applied.
  const historyPositionForStopIndex = useCallback((stopIndex: number) => {
    for (let i = stopIndex; i >= 0; i--) {
      const stop = sliderStops[i];
      if (stop?.kind === "history") return stop.index + 1;
    }
    return 0;
  }, [sliderStops]);

  // The inverse: the stop that represents a history position.
  const stopIndexForHistoryPosition = useCallback((historyPosition: number) => {
    if (historyPosition <= 0) return 0;
    // The end of the history is the last stop. Comments written after the final entry sit
    // beyond that entry and represent the same position, so the last stop stands for it.
    if (historyPosition >= history.length) return sliderStops.length - 1;
    return sliderStops.findIndex(s => s.kind === "history" && s.index === historyPosition - 1);
  }, [history.length, sliderStops]);

  const [currentStopIndex, setCurrentStopIndex] = useState(() => sliderStops.length - 1);

  // The document's history position can move without the slider being touched: a link
  // into a document's history seeks with goToHistoryEntryPosition. Follow it, so the thumb
  // reports where the document actually is. Several stops can share one history position —
  // a comment and the entry before it — so a stop that already represents the position is
  // left alone rather than snapped onto the history entry.
  useEffect(() => {
    if (numHistoryEventsApplied === undefined) return;
    setCurrentStopIndex(current => {
      if (historyPositionForStopIndex(current) === numHistoryEventsApplied) return current;
      return stopIndexForHistoryPosition(numHistoryEventsApplied);
    });
  }, [numHistoryEventsApplied, historyPositionForStopIndex, stopIndexForHistoryPosition]);

  // Undefined at the initial stop, which describes no change.
  const eventCreatedTime = useMemo(() => {
    const stop = sliderStops[currentStopIndex];
    return stop?.kind === "initial" ? undefined : stop?.created;
  }, [currentStopIndex, sliderStops]);

  const playbackDisabled =
    numHistoryEventsApplied === undefined || currentStopIndex === sliderStops.length - 1;

  const handlePlayPauseToggle = useCallback((playing?: boolean) => {
    const playStatus = playing !== undefined ? playing : !sliderPlaying;
    logCurrentHistoryEvent(treeManager, playStatus ? "playStart" : "playStop");
    setSliderPlaying(playStatus);
  }, [sliderPlaying, treeManager]);

  // After goToHistoryEntryPosition runs, numHistoryEventsApplied may differ from
  // what we requested if a failed entry blocked the move. We detect this
  // and show a warning.
  const [playbackFailureWarning, setPlaybackFailureWarning] = useState<string | null>(null);

  const goToSliderStop = useCallback(async (stopIndex: number) => {
    // set the playback time to the time of the entry so that the comment thread is in sync
    const sliderStop = sliderStops[stopIndex];
    if (sliderStop && sliderStop.kind !== "initial") {
      setPlaybackTime(sliderStop.created);
    }

    const newHistoryPosition = historyPositionForStopIndex(stopIndex);
    await treeManager.goToHistoryEntryPosition(newHistoryPosition);

    // Check if the move was blocked by a failed entry. If so, snap the
    // slider to the last fully applied position and show a warning.
    const actual = treeManager.numHistoryEventsApplied;
    if (actual !== undefined && actual !== newHistoryPosition) {
      setCurrentStopIndex(stopIndexForHistoryPosition(actual));
      setPlaybackFailureWarning("History playback could not apply some changes and was stopped.");
    } else {
      setCurrentStopIndex(stopIndex);
      setPlaybackFailureWarning(null);
    }
  }, [treeManager, sliderStops, setPlaybackTime,
      historyPositionForStopIndex, stopIndexForHistoryPosition]);

  const goToComment = useCallback((comment: WithId<CommentDocument>) => {
    const index = sliderStops.findIndex(s => s.kind === "comment" && s.entry.id === comment.id);
    if (index !== -1) {
      goToSliderStop(index);
    }
  }, [sliderStops, goToSliderStop]);

  useEffect(() => {
    if (sliderPlaying) {
      // Stop auto-play if we hit a playback failure
      if (playbackFailureWarning) {
        handlePlayPauseToggle(false);
        return;
      }
      const slider = setTimeout(()=>{
        if (currentStopIndex < sliderStops.length - 1) {
          goToSliderStop(currentStopIndex + 1);
        } else {
          handlePlayPauseToggle(false);
        }
      }, 500);
      return () => clearTimeout(slider);
    }
  }, [handlePlayPauseToggle, sliderStops.length, sliderPlaying, currentStopIndex,
      goToSliderStop, playbackFailureWarning]);

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
    goToSliderStop(value);
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
    const date = eventCreatedTime;
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

    // The entry this stop applied, which is the change on screen.
    const stop = sliderStops[currentStopIndex];
    const historyIndex = stop?.kind === "history" ? stop.index : undefined;

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
    // The rail spans the stops after the initial one, so that is what a position is a fraction of.
    const lastStop = sliderStops.length - 1;
    if (lastStop <= 0) {
      return 0;
    }

    const index = sliderStops.findIndex(stop => stop.kind === "comment" && stop.entry.id === comment.id);
    return Math.max(0, Math.min(100, 100 * (index / lastStop)));
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
            max={sliderStops.length - 1}
            step={1}
            value={currentStopIndex}
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
              isMe={comment.uid === user?.id}
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

  const [selectedFailure, setSelectedFailure] = useState<HistoryPlaybackFailure | null>(null);

  const renderPlaybackFailureMarkers = () => {
    const failures = treeManager.historyPlaybackFailures;
    const lastStop = sliderStops.length - 1;
    if (failures.length === 0 || lastStop <= 0) return null;

    // Deduplicate by history index for marker placement
    const seenIndices = new Set<number>();
    const uniqueFailures = failures.filter(f => {
      if (seenIndices.has(f.historyIndex)) return false;
      seenIndices.add(f.historyIndex);
      return true;
    });

    return (
      <div className="playback-failure-markers-container" data-testid="playback-failure-markers">
        {uniqueFailures.map(failure => {
          // The stop that would have applied the failing entry, which is the one playback
          // could not reach.
          const stopIndex = stopIndexForHistoryPosition(failure.historyIndex + 1);
          const location = Math.max(0, Math.min(100, 100 * (stopIndex / lastStop)));
          const isSelected = selectedFailure?.historyIndex === failure.historyIndex;
          return (
            <button
              key={`corrupt-${failure.historyIndex}`}
              type="button"
              className="playback-failure-marker"
              style={{ left: `calc(${location}% - 5px)` }}
              aria-label={`History playback failure at entry ${failure.historyIndex}`}
              aria-expanded={isSelected}
              onClick={() => setSelectedFailure(isSelected ? null : failure)}
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
                onClick={() => setSelectedFailure(null)}
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
      {playbackFailureWarning && !selectedFailure &&
        <div className="playback-failure-warning" data-testid="playback-failure-warning">
          {playbackFailureWarning}
        </div>
      }
    </div>
  );
});
PlaybackControlComponent.displayName = "PlaybackControlComponent";
