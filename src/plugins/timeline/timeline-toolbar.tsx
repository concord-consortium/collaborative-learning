import React from "react";
import { observer } from "mobx-react-lite";
import { DataSetViewButton } from "../../components/toolbar/data-set-view-button";
import { TileToolbarButton } from "../../components/toolbar/tile-toolbar-button";
import {
  IToolbarButtonComponentProps, registerTileToolbarButtons
} from "../../components/toolbar/toolbar-button-manager";
import { useLiveAnnouncer } from "../../hooks/use-live-announcer";
import { useTileModelContext } from "../../components/tiles/hooks/use-tile-model-context";
import { tileSelector } from "../../components/tiles/tile-dom";
import { useTimelineContent } from "./hooks/use-timeline-content";
import { formatTime } from "./components/describe-view";
import { kMarkerStemTestId } from "./components/time-marker-overlay";

import ZoomInIcon from "./assets/toolbar/zoom-in-icon.svg";
import ZoomOutIcon from "./assets/toolbar/zoom-out-icon.svg";
import ZoomToFitIcon from "./assets/toolbar/zoom-to-fit-icon.svg";
import PanLeftIcon from "./assets/toolbar/pan-left-icon.svg";
import AddMarkerIcon from "./assets/toolbar/add-marker-icon.svg";

const ZoomInButton = observer(function ZoomInButton({ name }: IToolbarButtonComponentProps) {
  const content = useTimelineContent();

  return (
    <TileToolbarButton
      name={name}
      title="Zoom In"
      onClick={() => content?.zoom(0.5)}
      disabled={!content?.canZoomIn}
    >
      <ZoomInIcon/>
    </TileToolbarButton>
  );
});

const ZoomOutButton = observer(function ZoomOutButton({ name }: IToolbarButtonComponentProps) {
  const content = useTimelineContent();

  return (
    <TileToolbarButton
      name={name}
      title="Zoom Out"
      onClick={() => content?.zoom(2)}
      disabled={!content?.canZoomOut}
    >
      <ZoomOutIcon/>
    </TileToolbarButton>
  );
});

const ViewAllButton = observer(function ViewAllButton({ name }: IToolbarButtonComponentProps) {
  const content = useTimelineContent();

  return (
    <TileToolbarButton
      name={name}
      title="View All"
      onClick={() => content?.fitToData()}
      disabled={!content?.canFitToData}
    >
      <ZoomToFitIcon/>
    </TileToolbarButton>
  );
});

const PanLeftButton = observer(function PanLeftButton({ name }: IToolbarButtonComponentProps) {
  const content = useTimelineContent();

  return (
    <TileToolbarButton
      name={name}
      title="Pan Left"
      onClick={() => content?.panLeft()}
      disabled={!content?.canPanLeft}
    >
      <PanLeftIcon/>
    </TileToolbarButton>
  );
});

const PanRightButton = observer(function PanRightButton({ name }: IToolbarButtonComponentProps) {
  const content = useTimelineContent();

  return (
    <TileToolbarButton
      name={name}
      title="Pan Right"
      onClick={() => content?.panRight()}
      disabled={!content?.canPanRight}
    >
      {/* There is only a left arrow asset; mirror it for the right. */}
      <PanLeftIcon style={{ transform: "scaleX(-1)" }}/>
    </TileToolbarButton>
  );
});

const AddMarkerButton = observer(function AddMarkerButton({ name }: IToolbarButtonComponentProps) {
  const content = useTimelineContent();
  const { tile } = useTileModelContext();
  const { announcerRef, announce } = useLiveAnnouncer();

  // Placement is a pointer gesture, so a keyboard user could press this button, see it report
  // itself pressed, and have no way to place anything (WCAG 2.1.1). Drop the marker in the middle
  // of the view instead and hand them the stem, which is a slider they can position from there.
  const placeFromKeyboard = () => {
    const time = content?.viewPctToTime(50);
    if (!time) return;
    content.setMarkerTime(time);
    announce(`Marker placed at ${formatTime(time)}.`);
    if (!tile?.id) return;
    // The marker mounts in the render this write causes, so wait for it. Read-only copies of the
    // same document carry the same tile id, so pick the stem that can take focus.
    requestAnimationFrame(() => document.querySelector<HTMLElement>(
      `${tileSelector(tile.id)} [data-testid="${kMarkerStemTestId}"][tabindex]`)?.focus());
  };

  const handleClick = (e: React.MouseEvent) => {
    // aria-pressed says this is a toggle, so pressing it again turns placement off, however it is
    // pressed.
    if (content?.isPlacingMarker) {
      content.stopPlacingMarker();
      announce("Marker placement cancelled.");
    // A button activated from the keyboard reports detail 0; a real click reports 1 or more.
    } else if (e.detail === 0) {
      placeFromKeyboard();
    } else {
      content?.startPlacingMarker();
      announce("Click the graph to place the time marker, or press Escape to cancel.");
    }
  };

  return (
    <TileToolbarButton
      name={name}
      title="Add Time Marker"
      onClick={handleClick}
      selected={content?.isPlacingMarker}
      // A marker left outside the data by a Wave Runner date change can no longer be reached to
      // delete, so it must not keep this button off for good. Placing a new one replaces it.
      disabled={!!content?.isMarkerInData || !content?.dataStartTime}
      disabledMessage={content?.isMarkerInData
                        ? "Delete the existing marker first" : "No data loaded"}
      // A button's contents are presentational to assistive technology, so the live region goes
      // beside it rather than inside it.
      extraContent={<div ref={announcerRef} className="visually-hidden" aria-live="polite" />}
    >
      <AddMarkerIcon/>
    </TileToolbarButton>
  );
});

registerTileToolbarButtons("timeline",
[
  {
    // This button takes an argument saying what kind of tile it should create.
    name: "data-set-view",
    component: DataSetViewButton
  },
  { name: "zoom-in", component: ZoomInButton },
  { name: "zoom-out", component: ZoomOutButton },
  { name: "view-all", component: ViewAllButton },
  { name: "add-marker", component: AddMarkerButton },
  { name: "pan-left", component: PanLeftButton },
  { name: "pan-right", component: PanRightButton }
]);
