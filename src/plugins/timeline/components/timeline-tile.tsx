import { observer } from "mobx-react";
import React, { useEffect, useLayoutEffect, useRef } from "react";
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

// The controls Tab visits in the tile's contents, in order: Prev, Next and the Full Timeline's
// scrollbar thumb, less any that are disabled. Read from their disabled state, not their tabindex,
// which the focus trap holds at -1 until the trap is entered.
const kContentControls =
  ".event-row .timeline-button:not(:disabled), .dynamic-scrollbar-thumb:not([aria-disabled])";
function getContentControls(container: HTMLElement | null) {
  return container ? Array.from(container.querySelectorAll<HTMLElement>(kContentControls)) : [];
}

export const TimelineComponent: React.FC<ITileProps> = observer(function TimelineComponent({
  model, readOnly, tileElt, onRegisterTileApi, onUnregisterTileApi
}) {
  const content = useTimelineContent();
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const refocusContentRef = useRef(false);
  const { ui } = useStores();
  const container = useContainerContext().model;

  // Prev or Next disables itself on reaching the first or last event, and a disabled button drops
  // focus out of the tile. Move it to the first control still enabled once the render has applied.
  useLayoutEffect(() => {
    if (!refocusContentRef.current) return;
    refocusContentRef.current = false;
    const target = getContentControls(timelineContainerRef.current)[0]
      ?? tileElt?.querySelector<HTMLElement>(".timeline-info-button");
    target?.focus();
  });

  const handleSelectEvent = (e: React.MouseEvent<HTMLButtonElement>, direction: "prev" | "next") => {
    const hadFocus = e.currentTarget === document.activeElement;
    if (direction === "prev") {
      content.selectPrevEvent();
    } else {
      content.selectNextEvent();
    }
    const staysEnabled = direction === "prev" ? content.canSelectPrev : content.canSelectNext;
    if (hadFocus && !staysEnabled) refocusContentRef.current = true;
  };

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
            onClick={e => handleSelectEvent(e, "prev")}
          >
            <ScrollArrowIcon /><span>Prev</span>
          </button>
          <button
            className="timeline-button next-button"
            disabled={!content.canSelectNext}
            onClick={e => handleSelectEvent(e, "next")}
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
            // The focus trap skips a slot with no element but stalls on one with nothing focusable,
            // so report the container only while it has a control to visit.
            const el = timelineContainerRef.current;
            return getContentControls(el).length > 0 ? el ?? undefined : undefined;
          }}
          focusContent={({ entryMode }) => {
            // Left to itself, the trap enters at the thumb, its only tabindex="0" element, past Prev
            // and Next.
            const controls = getContentControls(timelineContainerRef.current);
            const target = entryMode === "reverse" ? controls[controls.length - 1] : controls[0];
            target?.focus();
            return !!target && document.activeElement === target;
          }}
        />
      )}
    </div>
  );
});
TimelineComponent.displayName = "TimelineComponent";
