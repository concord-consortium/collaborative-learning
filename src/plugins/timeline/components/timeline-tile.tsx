import { observer } from "mobx-react";
import React, { useEffect } from "react";
import ScrollArrowIcon from "../../../assets/scroll-arrow-small-icon.svg";
import { useContainerContext } from "../../../components/document/container-context";
import { BasicEditableTileTitle } from "../../../components/tiles/basic-editable-tile-title";
import { ITileProps } from "../../../components/tiles/tile-component";
import { TileToolbar } from "../../../components/toolbar/tile-toolbar";
import { useStores } from "../../../hooks/use-stores";
import { userSelectTile } from "../../../models/stores/ui";
import { hasSelectionModifier } from "../../../utilities/event-utils";
import { useTimelineContent } from "../hooks/use-timeline-content";
import { Timeline } from "./timeline";
import { TimelineKey } from "./timeline-key";
import "../timeline-toolbar";
import "./timeline-tile.scss";

export const TimelineComponent: React.FC<ITileProps> = observer(function TimelineComponent({
  model, readOnly, tileElt
}) {
  const content = useTimelineContent();
  const { ui } = useStores();
  const container = useContainerContext().model;

  // Select the tile as TileComponent would, except that a modifier-click on the graph (Shift-click
  // zooms out) keeps this the only selected tile rather than toggling it out of the selection.
  useEffect(() => {
    if (!tileElt) return;
    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const onPlot = e.target instanceof Element && !!e.target.closest(".timeline-plot");
      userSelectTile(ui, model, { readOnly, append: !onPlot && hasSelectionModifier(e), container });
    };
    const options = { capture: true, passive: true };
    tileElt.addEventListener("mousedown", handlePointerDown, options);
    tileElt.addEventListener("touchstart", handlePointerDown, options);
    return () => {
      tileElt.removeEventListener("mousedown", handlePointerDown, options);
      tileElt.removeEventListener("touchstart", handlePointerDown, options);
    };
  }, [container, model, readOnly, tileElt, ui]);

  return (
    <div className="tile-content timeline-tile">
      <BasicEditableTileTitle />
      <TileToolbar tileType="timeline" readOnly={!!readOnly} tileElement={tileElt} />
      <div className="metadata-display">
        <div>{content.sharedSeismogram?.station?.label ?? ""}</div>
        <div>{content.modelLabel}</div>
        <div>{content.dataStartTime?.toUTC().toLocaleString() ?? ""}</div>
        <div>{content.dataEndTime?.toUTC().toLocaleString() ?? ""}</div>
      </div>
      <div className="timeline-container">
        <div className="event-row">
          <button
            className="timeline-button prev-button"
            disabled={!content.canSelectPrev}
            onClick={() => content.selectPrevEvent()}
          >
            <ScrollArrowIcon /><span>Prev</span>
          </button>
          <button
            className="timeline-button next-button"
            disabled={!content.canSelectNext}
            onClick={() => content.selectNextEvent()}
          >
            <span>Next</span><ScrollArrowIcon style={{ transform: "rotate(180deg)" }} />
          </button>
          <div className="event-label">{content.selectedEventLabel}</div>
        </div>
        <Timeline />
        <TimelineKey />
      </div>
    </div>
  );
});
TimelineComponent.displayName = "TimelineComponent";
