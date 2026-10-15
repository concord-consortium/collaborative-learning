import { observer } from "mobx-react";
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
import { HiddenEventTypesContext } from "./hidden-event-types-context";
import { Timeline } from "./timeline";
import { TimelineInfoButton } from "./timeline-info-button";
import { TimelineKey } from "./timeline-key";
import "../timeline-toolbar";
import "./timeline-tile.scss";

// The controls Tab visits in the tile's contents, in order: Prev, Next, the Full Timeline's
// scrollbar thumb and the Event Key's checkboxes, less any that are disabled.
const kContentControls =
  ".event-row .timeline-button:not(:disabled), .dynamic-scrollbar-thumb:not([aria-disabled]), " +
  ".timeline-key input[type=\"checkbox\"]:not(:disabled)";
function getContentControls(container: HTMLElement | null) {
  return container ? Array.from(container.querySelectorAll<HTMLElement>(kContentControls)) : [];
}

// The design zero-pads; Luxon's locale short date doesn't.
const kRunDateFormat = "MM/dd/yyyy";

export const TimelineComponent: React.FC<ITileProps> = observer(function TimelineComponent({
  model, readOnly, tileElt, onRegisterTileApi, onUnregisterTileApi
}) {
  const content = useTimelineContent();

  // Which types this pane has switched off. A reader gets their own copy, seeded from the document
  // and kept here rather than on the model: CLUE shows one model in an editable pane and a
  // read-only one at the same time, and a filter on the model would reach both. It lasts as long
  // as this pane is open.
  const [readerHiddenTypes, setReaderHiddenTypes] = useState<string[]>(() =>
    Array.from(content.hiddenEventTypes));
  const toggleHiddenType = useCallback((eventType: string) => {
    if (readOnly) {
      setReaderHiddenTypes(hidden => hidden.includes(eventType)
        ? hidden.filter(t => t !== eventType)
        : [...hidden, eventType]);
    } else {
      content.toggleEventType(eventType);
    }
  }, [content, readOnly]);
  const savedHiddenTypes = Array.from(content.hiddenEventTypes);
  const hiddenEventTypes = useMemo(
    () => ({ types: readOnly ? readerHiddenTypes : savedHiddenTypes, toggle: toggleHiddenType }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [readOnly, readerHiddenTypes, savedHiddenTypes.join("\u0000"), toggleHiddenType]);

  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const refocusContentRef = useRef(false);
  const { ui } = useStores();
  const container = useContainerContext().model;

  // Prev or Next disables itself on reaching the first or last event, and a disabled button drops
  // focus out of the tile. Move it to the first control still enabled once the render has applied.
  useLayoutEffect(() => {
    if (!refocusContentRef.current) return;
    refocusContentRef.current = false;
    getContentControls(timelineContainerRef.current)[0]?.focus();
  });

  const handleSelectEvent = (e: React.MouseEvent<HTMLButtonElement>, direction: "prev" | "next") => {
    const hadFocus = e.currentTarget === document.activeElement;
    if (direction === "prev") {
      content.selectPrevEvent(hiddenEventTypes.types);
    } else {
      content.selectNextEvent(hiddenEventTypes.types);
    }
    const staysEnabled = direction === "prev"
      ? content.canSelectPrev(hiddenEventTypes.types) : content.canSelectNext(hiddenEventTypes.types);
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
    <HiddenEventTypesContext.Provider value={hiddenEventTypes}>
    <div className="tile-content timeline-tile">
      <BasicEditableTileTitle>
        <TimelineInfoButton />
      </BasicEditableTileTitle>
      <TileToolbar tileType="timeline" readOnly={!!readOnly} tileElement={tileElt} />
      <div className="metadata-display">
        <div>{content.sharedSeismogram?.station?.label ?? ""}</div>
        <div>{content.dataStartTime?.toUTC().toFormat(kRunDateFormat) ?? ""}</div>
        <div>{content.dataEndTime?.toUTC().toFormat(kRunDateFormat) ?? ""}</div>
      </div>
      <div className="timeline-container" ref={timelineContainerRef}>
        <div className="event-row">
          <button
            className="timeline-button prev-button"
            disabled={!content.canSelectPrev(hiddenEventTypes.types)}
            onClick={e => handleSelectEvent(e, "prev")}
          >
            <ScrollArrowIcon /><span>Prev</span>
          </button>
          <button
            className="timeline-button next-button"
            disabled={!content.canSelectNext(hiddenEventTypes.types)}
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
    </HiddenEventTypesContext.Provider>
  );
});
TimelineComponent.displayName = "TimelineComponent";
