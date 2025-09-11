import React, { useCallback, useEffect, useRef } from "react";
import classNames from "classnames";
import { observer } from "mobx-react-lite";
import { ScaleLinear } from "d3";

import { kSmallAnnotationNodeRadius } from "../../../components/annotations/annotation-utilities";
import { BasicEditableTileTitle } from "../../../components/tiles/basic-editable-tile-title";
import { ITileProps } from "../../../components/tiles/tile-component";
import { OffsetModel } from "../../../models/annotations/clue-object";
import { ITileExportOptions } from "../../../models/tiles/tile-content-info";
import {
  GraphSettingsContext, IGraphSettings, IGraphSettingsFromStores, kDefaultGraphSettings
} from "../hooks/use-graph-settings-context";
import { useInitGraphLayout } from "../hooks/use-init-graph-layout";
import { useSettingFromStores, useUIStore } from "../../../hooks/use-stores";
import { IGraphModel } from "../models/graph-model";
import { decipherDotId } from "../utilities/graph-utils";
import { GraphComponent } from "./graph-component";
import { isNumericAxisModel } from "../imports/components/axis/models/axis-model";
import { Point } from "../graph-types";
import { HotKeys } from "../../../utilities/hot-keys";

import "./graph-toolbar-registration";

import "./graph-wrapper-component.scss";

export const GraphWrapperComponent: React.FC<ITileProps> = observer(function(props) {
  const {
    model, readOnly, tileElt, onRegisterTileApi, onRequestRowHeight
  } = props;
  const ui = useUIStore();
  const graphSettingsFromStores = useSettingFromStores("graph") as IGraphSettingsFromStores;
  const graphSettings: IGraphSettings = { ...kDefaultGraphSettings, ...graphSettingsFromStores };
  const content = model.content as IGraphModel;
  const hotKeys = useRef(new HotKeys());

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

  useEffect(() => {
    onRegisterTileApi?.({
      exportContentAsTileJson: (options?: ITileExportOptions) => {
        return content.exportJson(options);
      },
      getObjectBoundingBox: (objectId: string, objectType?: string) => {
        let coords;
        if (objectType === "dot") {
          coords = getDotCenter(objectId);
        // Check location cache
        } else if (content.annotationLocationCache.has(objectId)){
          const location = content.annotationLocationCache.get(objectId);
          console.log(`--- location`, location);
          if (location) {
            const size = content.annotationSizesCache.get(objectId);
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
          console.log(` -- returning bb for`, coords);
          return boundingBoxForPoint(coords);
        }
      },
      getObjectButtonSVG: ({ classes, handleClick, objectId, objectType }) => {
        let coords;
        if (objectType === "dot") {
          // Native graph object
          coords = getDotCenter(objectId);
        } else if (content.annotationSizesCache.has(objectId)) {
          // Adornment object with rectangle shape; do not return SVG
          return undefined;
        } else if (content.annotationLocationCache.has(objectId)){
          // Adornment object with dot shape
          coords = content.annotationLocationCache.get(objectId);
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
    });
    // xDomain and yDomain are included to force updating the sparrow locations when they change
  }, [getDotCenter, content, layout, onRegisterTileApi, getPositionFromAdornment,
    boundingBoxForPoint, getScaledPosition]);

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
    <GraphSettingsContext.Provider value={graphSettings}>
      <div
        className={wrapperClasses}
        onKeyDown={(e) => hotKeys.current.dispatch(e)}
        tabIndex={0} // must be able to take focus so that it can receive keyDown events
      >
        <BasicEditableTileTitle />
        <GraphComponent
          layout={layout}
          tile={model}
          tileElt={tileElt}
          onRequestRowHeight={onRequestRowHeight}
          readOnly={readOnly}
        />
      </div>
    </GraphSettingsContext.Provider>
  );
});
