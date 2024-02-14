import React, { useCallback, useEffect } from "react";
import classNames from "classnames";
import { observer } from "mobx-react-lite";

import { kSmallAnnotationNodeRadius } from "../../../components/annotations/annotation-utilities";
import { BasicEditableTileTitle } from "../../../components/tiles/basic-editable-tile-title";
import { ITileProps } from "../../../components/tiles/tile-component";
import { OffsetModel } from "../../../models/annotations/clue-object";
import { ITileExportOptions } from "../../../models/tiles/tile-content-info";
import {
  GraphSettingsContext, IGraphSettings, IGraphSettingsFromStores, kDefaultGraphSettings
} from "../hooks/use-graph-settings-context";
import { useInitGraphLayout } from "../hooks/use-init-graph-layout";
import { getScreenX, getScreenY } from "../hooks/use-point-locations";
import { useSettingFromStores } from "../../../hooks/use-stores";
import { IGraphModel } from "../models/graph-model";
import { decipherDotId } from "../utilities/graph-utils";
import { GraphComponent } from "./graph-component";
import { isNumericAxisModel } from "../imports/components/axis/models/axis-model";
import { Point } from "../graph-types";
import { ScaleLinear } from "d3";

import "./graph-toolbar-registration";

import "./graph-wrapper-component.scss";

export const GraphWrapperComponent: React.FC<ITileProps> = observer(function(props) {
  const {
    model, readOnly, tileElt, onRegisterTileApi, onRequestRowHeight
  } = props;
  const graphSettingsFromStores = useSettingFromStores("graph") as IGraphSettingsFromStores;
  const graphSettings: IGraphSettings = { ...kDefaultGraphSettings, ...graphSettingsFromStores };
  const content = model.content as IGraphModel;

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

      const x = getScreenX({ caseId, dataset: layer.config.dataset, layout, dataConfig: layer.config });
      const y = getScreenY({ caseId, dataset: layer.config.dataset, layout, dataConfig: layer.config, plotNum });
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

  useEffect(() => {
    onRegisterTileApi?.({
      exportContentAsTileJson: (options?: ITileExportOptions) => {
        return content.exportJson(options);
      },
      getObjectBoundingBox: (objectId: string, objectType?: string) => {
        let coords;
        if (objectType === "dot") {
          coords = getDotCenter(objectId);
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
        if (objectType === "dot") {
          coords = getDotCenter(objectId);
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
  }, [getDotCenter, content, layout, onRegisterTileApi,
      getPositionFromAdornment, boundingBoxForPoint, getScaledPosition]);

  useEffect(function cleanup() {
    return () => {
      layout.cleanup();
    };
  }, [layout]);

  return (
    <GraphSettingsContext.Provider value={graphSettings}>
      <div className={classNames("graph-wrapper", { "read-only": readOnly })}>
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
