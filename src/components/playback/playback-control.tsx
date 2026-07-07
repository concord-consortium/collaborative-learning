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
    // History entries must stay in index order (their position in the array),
    // not sorted by created time. Created times can be out of order when
    // sub-actions complete before their parent action.
    const historyEntries: ISliderEntry[] = history
      .map((entry, index) => ({kind: "history" as const, entry, created: entry.created, index}));

    // Insert comments at the correct position among history entries based
    // on the comment's created time. Each comment goes after the last
    // history entry whose created time is <= the comment's created time.
    const sortedComments = [...allComments].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );
    const entries: ISliderEntry[] = [];
    let commentIdx = 0;
    for (const historyEntry of historyEntries) {
      while (commentIdx < sortedComments.length &&
             sortedComments[commentIdx].createdAt.getTime() < historyEntry.created.getTime()) {
        const comment = sortedComments[commentIdx];
        entries.push({kind: "comment", entry: comment, created: comment.createdAt});
        commentIdx++;
      }
      entries.push(historyEntry);
    }
    while (commentIdx < sortedComments.length) {
      const comment = sortedComments[commentIdx];
      entries.push({kind: "comment", entry: comment, created: comment.createdAt});
      commentIdx++;
    }
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

  // After goToHistoryEntry runs, numHistoryEventsApplied may differ from
  // what we requested if a failed entry blocked the move. We detect this
  // and show a warning.
  const [playbackFailureWarning, setPlaybackFailureWarning] = useState<string | null>(null);

  const goToSliderValue = useCallback(async (value: number) => {
    // the slider max is sliderEntries.length, which is one more than the last index
    // in sliderEntries. This value indicates going to the end of the history.
    const sliderEntry = sliderEntries[value];

    // figure out which history entry to go to
    let newHistoryEntryIndex = 0;
    if (sliderEntry) {
      // set the playback time to the time of the entry so that the comment thread is in sync
      setPlaybackTime(sliderEntry.created);

      if (sliderEntry.kind === "history") {
        newHistoryEntryIndex = sliderEntry.index;
      } else {
        // go to the history entry just before the comment (or any other future slider entry kinds) was made
        // to keep the canvas in sync
        for (let i = value - 1; i >= 0; i--) {
          const entry = sliderEntries[i];
          if (entry.kind === "history") {
            newHistoryEntryIndex = entry.index;
            break;
          }
        }
      }
    } else {
      // go to the final history entry when at the end of the slider
      newHistoryEntryIndex = history.length;
    }
    await treeManager.goToHistoryEntry(newHistoryEntryIndex);

    // Check if the move was blocked by a failed entry. If so, snap the
    // slider to the last fully applied position and show a warning.
    const actual = treeManager.numHistoryEventsApplied;
    if (actual !== undefined && actual !== newHistoryEntryIndex) {
      // Find the slider entry that corresponds to the actual history
      // position. The end-of-history position is represented by
      // sliderEntries.length (one past the last index), not by any
      // entry inside sliderEntries, so findIndex can't locate it.
      const actualSliderIndex = actual === history.length
        ? sliderEntries.length
        : sliderEntries.findIndex(
          e => e.kind === "history" && e.index === actual
        );
      setSliderValue(actualSliderIndex >= 0 ? actualSliderIndex : value);
      setPlaybackFailureWarning("History playback could not apply some changes and was stopped.");
    } else {
      setSliderValue(value);
      setPlaybackFailureWarning(null);
    }
  }, [treeManager, history, sliderEntries, setPlaybackTime]);

  const goToComment = useCallback((comment: WithId<CommentDocument>) => {
    const index = sliderEntries.findIndex(e => e.kind === "comment" && e.entry.id === comment.id);
    if (index !== -1) {
      goToSliderValue(index);
    }
  }, [sliderEntries, goToSliderValue]);

  useEffect(() => {
    if (sliderPlaying) {
      // Stop auto-play if we hit a playback failure
      if (playbackFailureWarning) {
        handlePlayPauseToggle(false);
        return;
      }
      const slider = setTimeout(()=>{
        if (sliderValue < sliderEntries.length) {
          goToSliderValue(sliderValue + 1);
        } else {
          handlePlayPauseToggle(false);
        }
      }, 500);
      return () => clearTimeout(slider);
    }
  }, [handlePlayPauseToggle, sliderEntries.length, sliderPlaying, sliderValue,
      goToSliderValue, playbackFailureWarning]);

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

    const entry = sliderEntries[sliderValue];
    const historyIndex = entry?.kind === "history" ? entry.index : undefined;

    return (
      <div className={"time-info"} data-testid="playback-time-info">
        <div className={"date-info"}>{monthStr} {dateDay}, {year}</div>
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
    if (failures.length === 0 || sliderEntries.length === 0) return null;

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
          const sliderIndex = sliderEntries.findIndex(
            e => e.kind === "history" && e.index === failure.historyIndex
          );
          if (sliderIndex < 0) return null;
          const location = Math.max(0, Math.min(100, 100 * (sliderIndex / sliderEntries.length)));
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
