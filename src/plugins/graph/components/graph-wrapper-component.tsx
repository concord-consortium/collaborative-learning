import React, { useCallback, useEffect, useMemo, useRef } from "react";
import classNames from "classnames";
import { observer } from "mobx-react-lite";
import { ScaleLinear } from "d3";

import { kSmallAnnotationNodeRadius } from "../../../components/annotations/annotation-utilities";
import { BasicEditableTileTitle } from "../../../components/tiles/basic-editable-tile-title";
import { ITileApi } from "../../../components/tiles/tile-api";
import { ITileProps } from "../../../components/tiles/tile-component";
import { useClueAccessibility } from "../../../hooks/use-clue-accessibility";
import { useSettingFromStores, useUIStore } from "../../../hooks/use-stores";
import { OffsetModel } from "../../../models/annotations/clue-object";
import { ITileExportOptions } from "../../../models/tiles/tile-content-info";
import { getEditableTitleElement } from "../../../utilities/dom-utils";
import { HotKeys } from "../../../utilities/hot-keys";
import { Point } from "../graph-types";
import {
  GraphSettingsContext, IGraphSettings, IGraphSettingsFromStores, kDefaultGraphSettings
} from "../hooks/use-graph-settings-context";
import { useInitGraphLayout } from "../hooks/use-init-graph-layout";
import { isNumericAxisModel } from "../imports/components/axis/models/axis-model";
import { InstanceIdContext, useNextInstanceId } from "../imports/hooks/use-instance-id-context";
import { IGraphModel } from "../models/graph-model";
import { decipherDotId } from "../utilities/graph-utils";
import { GraphComponent } from "./graph-component";

import "./graph-toolbar-registration";

import "./graph-wrapper-component.scss";

/**
 * Focuses an entry tab stop inside the graph content area.
 *
 * Forward: first axis-label tab stop (X-axis).
 * Reverse: dots-group surrogate when it's a real tab stop (has non-zero size,
 *   i.e. data is linked), otherwise the last axis-label tab stop (Y-axis).
 *
 * Why explicit selectors instead of `getVisibleFocusables(content)[last]`: the
 * graph content also renders CODAP-mode legend triggers inside `.graph-svg`,
 * which would otherwise be considered "after" the dots-group in DOM order and
 * steal the reverse-entry target.
 *
 * @param contentElement The content slot element (the plot area), or null.
 * @param reverse When true, picks the *last* content tab stop; otherwise the first.
 * @returns True when focus landed somewhere inside content.
 */
function focusContentEntry(contentElement: HTMLElement | null, reverse: boolean): boolean {
  if (!contentElement) return false;

  if (reverse) {
    const dotsGroup = contentElement.querySelector<SVGElement>('[data-graph-dots-group]');
    if (dotsGroup) {
      const { width, height } = dotsGroup.getBoundingClientRect();
      if (width > 0 && height > 0) {
        dotsGroup.focus();
        // useGraphDotsKeyboard re-focuses a child dot on group focus, so accept
        // either the surrogate or a descendant as a successful landing.
        const active = document.activeElement;
        if (active && (active === dotsGroup || dotsGroup.contains(active))) return true;
      }
    }
  }

  const labels = contentElement.querySelectorAll<HTMLElement>('.axis-label[tabindex="0"]');
  if (labels.length === 0) return false;
  const target = reverse ? labels[labels.length - 1] : labels[0];
  target.focus();
  return document.activeElement === target;
}

export const GraphWrapperComponent: React.FC<ITileProps> = observer(function(props) {
  const {
    model, readOnly, tileElt, onRegisterTileApi, onUnregisterTileApi, onRequestRowHeight
  } = props;
  const instanceId = useNextInstanceId("graph");
  const ui = useUIStore();
  const graphSettingsFromStores = useSettingFromStores("graph") as IGraphSettingsFromStores;
  const graphSettings: IGraphSettings = { ...kDefaultGraphSettings, ...graphSettingsFromStores };
  const content = model.content as IGraphModel;
  const hotKeys = useRef(new HotKeys());

  // Content and palette elements are queried lazily from `tileElt`. Both live
  // deep inside GraphComponent → Graph (the plot area) / GraphComponent → Graph
  // → MultiLegend (the legend container); querying via `tileElt` avoids threading
  // a ref through three layers. The trap controller calls these getters on
  // every cycle, so they pick up DOM that mounts after the wrapper renders.
  //
  // Content points at the inner `.graph-svg` rather than the outer `.graph-plot`
  // div on purpose: `.graph-plot` also contains `.multi-legend` (the palette),
  // and the trap controller resolves a focused element's slot by DOM containment
  // walking `cycleOrder` (title → topbar → content → palette → …). If content
  // matched first, every legend control would be attributed to content (which is
  // in `tabWithinSlots`), making Tab cycle through legend + content together.
  // Pointing content at `.graph-svg` keeps the slot boundary correct.
  const getContentElement = useCallback(() => {
    return tileElt?.querySelector<HTMLElement>(".graph-svg") ?? undefined;
  }, [tileElt]);
  const getPaletteElement = useCallback(() => {
    return tileElt?.querySelector<HTMLElement>(".multi-legend") ?? undefined;
  }, [tileElt]);

  const layout = useInitGraphLayout(content);
  const xAttrType = content.config.attributeType("x");
  const yAttrType = content.config.attributeType("y");

  // This is used for locating Sparrow endpoints.
  const getDotCenter = useCallback((dotId: string) => {
    // FIXME Currently, getScreenX and getScreenY only handle numeric axes, so just bail if they are a different type.
    if (xAttrType !== "numeric" || yAttrType !== "numeric") return;
    const idParts = decipherDotId(dotId);
    if (!idParts) return;
    const { caseId, xAttributeId, yAttributeId } = idParts;
    if (caseId && xAttributeId && yAttributeId) {
      const layer = content.layerForAttributeId(xAttributeId);
      if (!layer) return;
      const plotNum = layer.config.plotNumberForAttributeID(yAttributeId);
      if (plotNum === undefined) return;

      // We don't use these values directly, but without referencing them the app
      // doesn't realize that changes in the axis scales require redrawing the annotations.
      const xAxis = content.getAxis("bottom");
      const yAxis = content.getAxis("left");
      // eslint-disable-next-line unused-imports/no-unused-vars
      const domains = [isNumericAxisModel(xAxis) && xAxis.domain, isNumericAxisModel(yAxis) && yAxis.domain];

      const xValue = layer.config.dataset?.getNumeric(caseId, xAttributeId);
      const yValue = layer.config.dataset?.getNumeric(caseId, yAttributeId);
      const x = xValue !== undefined
        ? layout.getAxisMultiScale("bottom").getScreenCoordinate({ cell: 0, data: xValue }) : NaN;
      const y = yValue !== undefined
        ? layout.getAxisMultiScale("left").getScreenCoordinate({ cell: 0, data: yValue }) : NaN;

      if (!isFinite(x) || !isFinite(y)) return;
      return { x, y };
    }
  }, [xAttrType, yAttrType, content, layout]);

  const getPositionFromAdornment = useCallback((type: string, objectId: string) => {
    // Ask each adornment in turn if it knows how to handle this object.
    for (const adorn of content.adornments) {
      const pos = adorn.getAnnotatableObjectPosition(type, objectId);
      if (pos) return pos;
    }
  }, [content.adornments]);

  const handleDelete = useCallback(() => {
    content.clearSelectedAdornmentInstances();
    content.clearSelectedCellValues();
  }, [content]);

  const getScaledPosition = useCallback((pos: Point) => {
    const xScale = layout.getAxisScale('bottom') as ScaleLinear<number, number>;
    const yScale = layout.getAxisScale('left') as ScaleLinear<number, number>;
    return { x: xScale(pos.x), y: yScale(pos.y) };
  }, [layout]);

  const boundingBoxForPoint = useCallback((pos: Point) => {
    const halfSide = content.getPointRadius("hover-drag");
    return {
      top: pos.y - halfSide,
      left: pos.x - halfSide + layout.getComputedBounds("left").width,
      height: 2 * halfSide,
      width: 2 * halfSide
    };
  }, [content, layout]);

  // One-time setup
  useEffect(() => {
    if (!readOnly) {
      hotKeys.current.register({
        "delete": handleDelete,
        "backspace": handleDelete
      });
    }
  }, [handleDelete, readOnly]);

  const tileAdditionalApi = useMemo<Partial<ITileApi>>(() => ({
    exportContentAsTileJson: (options?: ITileExportOptions) => {
      return content.exportJson(options);
    },
    getObjectBoundingBox: (objectId: string, objectType?: string) => {
      let coords;
      const annotationLocationCache = content.annotationLocationCaches.get(instanceId);
      const annotationSizesCache = content.annotationSizesCaches.get(instanceId);
      if (objectType === "dot") {
        coords = getDotCenter(objectId);
      // Check location cache
      } else if (annotationLocationCache && annotationSizesCache && annotationLocationCache.has(objectId)){
        const location = annotationLocationCache.get(objectId);
        if (location) {
          const size = annotationSizesCache.get(objectId);
          if (size) { // This is a rectangle of defined width & height
            const bbox = {
              left: location.x + layout.getComputedBounds("plot").left,
              top: location.y + layout.getComputedBounds("plot").top,
              ...size };
            return bbox;
          }
          return boundingBoxForPoint(location);
        }
      } else {
        // Maybe one of our adornments knows about this object
        const pos = objectType && getPositionFromAdornment(objectType, objectId);
        coords = pos && getScaledPosition(pos);
      }
      if (coords) {
        return boundingBoxForPoint(coords);
      }
    },
    getObjectButtonSVG: ({ classes, handleClick, objectId, objectType }) => {
      let coords;
      const annotationLocationCache = content.annotationLocationCaches.get(instanceId);
      if (objectType === "dot") {
        // Native graph object
        coords = getDotCenter(objectId);
      } else if (content.annotationSizesCaches.get(instanceId)?.has(objectId)) {
        // Adornment object with rectangle shape; do not return SVG
        return undefined;
      } else if (annotationLocationCache?.has(objectId)) {
        // Adornment object with dot shape
        coords = annotationLocationCache.get(objectId);
      } else if (objectType) {
        const pos = getPositionFromAdornment(objectType, objectId);
        coords = pos && getScaledPosition(pos);
      }
      if (!coords) return;
      const { x, y } = coords;
      const cx = x + layout.getComputedBounds("left").width;
      const radius = content.getPointRadius("hover-drag");

      // Return a circle at the center point
      return (
        <circle
          className={classes}
          cx={cx}
          cy={y}
          onClick={handleClick}
          r={radius}
        />
      );
    },
    getObjectDefaultOffsets: (objectId: string, objectType?: string) => {
      const offsets = OffsetModel.create({});
      offsets.setDy(-kSmallAnnotationNodeRadius);
      return offsets;
    },
    getObjectNodeRadii: (objectId: string, objectType?: string) => {
      return {
        centerRadius: kSmallAnnotationNodeRadius / 2,
        highlightRadius: kSmallAnnotationNodeRadius
      };
    }
  }), [content, instanceId, layout, getDotCenter, getPositionFromAdornment, boundingBoxForPoint, getScaledPosition]);

  // Editable tiles register the tile API (including focus-trap getFocusableElements)
  // through useClueAccessibility. Read-only tiles use `type: "region"`, which does
  // not register a tile API — so we register `tileAdditionalApi` directly below for
  // read-only graphs so annotation lookup and export still work.
  useClueAccessibility(readOnly ? { type: "region" } : {
    type: "tile",
    focusTrap: {
      tileType: "graph",
      onRegisterTileApi,
      onUnregisterTileApi,
      getTitleElement: () => getEditableTitleElement(tileElt ?? undefined),
      getContentElement,
      getPaletteElement,
      focusContent: ({ entryMode }) => focusContentEntry(getContentElement() ?? null, entryMode === "reverse"),
      additionalApi: tileAdditionalApi,
      // The graph's CLUE-legend palette has many heterogeneous native controls
      // (unlink button, dataset-name edit pencil, color picker, attribute menu
      // triggers, add-series button) and users expect Tab to step through them
      // individually rather than treating the whole legend as one tab stop.
      // Opt palette into the trap's within-slot Tab routing.
      tabWithinSlots: ["topbar", "content", "palette"],
      // While an inline axis-label editor (InputTextbox) is focused, Escape
      // should cancel the edit and return focus to the trigger — not exit the
      // trap. Returning "handled" tells the trap not to exit and not to
      // stopPropagation, so the InputTextbox's React onKeyDown sees the same
      // Escape during the bubble phase and performs the cancel.
      escapeHandlers: {
        content: () => {
          const active = document.activeElement;
          if (active instanceof HTMLElement && active.classList.contains("input-textbox")) {
            return "handled";
          }
          return "exit";
        },
      },
    },
  });


  // Read-only path: register the annotation/export API directly (the region branch of
  // useClueAccessibility above doesn't touch tile API at all). Mirrors drawing-tile.tsx.
  useEffect(() => {
    if (readOnly) {
      onRegisterTileApi?.(tileAdditionalApi);
      return () => onUnregisterTileApi?.();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Capture Delete / Backspace on the .tool-tile container. Previously the wrapper
  // div had `tabIndex={0}` + inline `onKeyDown` to receive these keys, but the focus
  // trap requires the wrapper not to be its own tab stop. The .tool-tile element is
  // the focus-trap root, so attaching the listener there gives us the same coverage
  // without adding a stray tab stop. Gated on selected + editable, mirroring the
  // original behavior.
  useEffect(() => {
    if (!tileElt || readOnly) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!ui.isSelectedTile(model)) return;
      // HotKeys.dispatch is typed for React.KeyboardEvent but only reads modifier-key
      // flags, `keyCode`, and the preventDefault/stopPropagation methods — all present
      // on the native KeyboardEvent. Cast through unknown to satisfy the signature.
      hotKeys.current.dispatch(e as unknown as React.KeyboardEvent);
    };
    tileElt.addEventListener("keydown", handleKeyDown);
    return () => tileElt.removeEventListener("keydown", handleKeyDown);
  }, [tileElt, readOnly, ui, model]);

  useEffect(function cleanup() {
    return () => {
      layout.cleanup();
    };
  }, [layout]);

  const wrapperClasses = classNames("tile-content", "graph-wrapper", {
    hovered: props.hovered,
    "read-only": readOnly,
    selected: ui.isSelectedTile(model),
  });

  return (
    <InstanceIdContext.Provider value={instanceId}>
      <GraphSettingsContext.Provider value={graphSettings}>
        <div className={wrapperClasses}>
          <BasicEditableTileTitle />
          <GraphComponent
            layout={layout}
            tile={model}
            tileElt={tileElt}
            onRequestRowHeight={onRequestRowHeight}
            readOnly={readOnly}
          />
          {/* Aria-live region for dot-selection announcements. Walked up to by
              useGraphDotsKeyboard via the `data-graph-announcer` marker. */}
          <div
            aria-live="polite"
            className="visually-hidden"
            data-graph-announcer=""
          />
        </div>
      </GraphSettingsContext.Provider>
    </InstanceIdContext.Provider>
  );
});
