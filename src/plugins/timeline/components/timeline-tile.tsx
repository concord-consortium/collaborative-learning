import { getVisibleFocusables } from "@concord-consortium/accessibility-tools/hooks";
import { observer } from "mobx-react";
import React, { useEffect, useRef } from "react";
import ScrollArrowIcon from "../../../assets/scroll-arrow-small-icon.svg";
import { useContainerContext } from "../../../components/document/container-context";
import { BasicEditableTileTitle } from "../../../components/tiles/basic-editable-tile-title";
import { ITileProps } from "../../../components/tiles/tile-component";
import { TileToolbar } from "../../../components/toolbar/tile-toolbar";
import { ClueTileAccessibilityBridge } from "../../../hooks/use-clue-accessibility";
import { useStores } from "../../../hooks/use-stores";
import { userSelectTile } from "../../../models/stores/ui";
import { getEditableTitleElement } from "../../../utilities/dom-utils";
import { hasSelectionModifier } from "../../../utilities/event-utils";
import { useTimelineContent } from "../hooks/use-timeline-content";
import { Timeline } from "./timeline";
import { TimelineInfoButton } from "./timeline-info-button";
import { TimelineKey } from "./timeline-key";
import "../timeline-toolbar";
import "./timeline-tile.scss";

export const TimelineComponent: React.FC<ITileProps> = observer(function TimelineComponent({
  model, readOnly, tileElt, onRegisterTileApi, onUnregisterTileApi
}) {
  const content = useTimelineContent();
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const { ui } = useStores();
  const container = useContainerContext().model;

  // Select the tile as TileComponent would, except that a modifier-click on the graph (Shift-click
  // zooms out) keeps this the only selected tile rather than toggling it out of the selection.
  // Listens for pointerdown because the Full Timeline and the scrollbar cancel it, which suppresses
  // the mousedown that would follow.
  useEffect(() => {
    if (!tileElt) return;
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      // The drag handle selects the tile itself, on click.
      if (target?.closest(".tool-tile-drag-handle-wrapper")) return;
      const onPlot = !!target?.closest(".timeline-plot");
      userSelectTile(ui, model, { readOnly, append: !onPlot && hasSelectionModifier(e), container });
    };
    const options = { capture: true, passive: true };
    tileElt.addEventListener("pointerdown", handlePointerDown, options);
    return () => tileElt.removeEventListener("pointerdown", handlePointerDown, options);
  }, [container, model, readOnly, tileElt, ui]);

  return (
    <div className="tile-content timeline-tile">
      <BasicEditableTileTitle>
        <TimelineInfoButton />
      </BasicEditableTileTitle>
      <TileToolbar tileType="timeline" readOnly={!!readOnly} tileElement={tileElt} />
      <div className="metadata-display">
        <div>{content.sharedSeismogram?.station?.label ?? ""}</div>
        <div>{content.modelLabel}</div>
        <div>{content.dataStartTime?.toUTC().toLocaleString() ?? ""}</div>
        <div>{content.dataEndTime?.toUTC().toLocaleString() ?? ""}</div>
      </div>
      <div className="timeline-container" ref={timelineContainerRef}>
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
      {!readOnly && (
        <ClueTileAccessibilityBridge
          tileType="timeline"
          onRegisterTileApi={onRegisterTileApi}
          onUnregisterTileApi={onUnregisterTileApi}
          getTitleElement={() => getEditableTitleElement(tileElt)}
          getTopbarElement={() => tileElt?.querySelector<HTMLElement>(".timeline-info-button") ?? undefined}
          getContentElement={() => {
            // Tab walks Prev, Next and the scrollbar thumb, skipping any that are disabled. The focus
            // trap skips a slot with no element but stalls on one with nothing focusable, so report
            // the container only while one of them is enabled.
            const el = timelineContainerRef.current;
            return el && getVisibleFocusables(el).length > 0 ? el : undefined;
          }}
        />
      )}
    </div>
  );
});
TimelineComponent.displayName = "TimelineComponent";
