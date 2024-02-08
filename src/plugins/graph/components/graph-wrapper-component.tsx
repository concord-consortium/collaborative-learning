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

  const xAxis = content.getAxis("bottom");
  const xDomain = isNumericAxisModel(xAxis) && xAxis.domain;
  const yAxis = content.getAxis("left");
  const yDomain = isNumericAxisModel(yAxis) && yAxis.domain;

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
      const x = getScreenX({ caseId, dataset: layer.config.dataset, layout, dataConfig: layer.config });
      const y = getScreenY({ caseId, dataset: layer.config.dataset, layout, dataConfig: layer.config });
      if (!isFinite(x) || !isFinite(y)) return;
      return { x, y };
    }
  }, [xAttrType, yAttrType, content, layout]);

  useEffect(() => {
    onRegisterTileApi?.({
      exportContentAsTileJson: (options?: ITileExportOptions) => {
        return content.exportJson(options);
      },
      getObjectBoundingBox: (objectId: string, objectType?: string) => {
        if (objectType === "dot") {
          const coords = getDotCenter(objectId);
          if (!coords) return;
          const { x, y } = coords;
          const halfSide = content.getPointRadius("hover-drag");
          const boundingBox = {
            height: 2 * halfSide,
            left: x - halfSide + layout.getComputedBounds("left").width,
            top: y - halfSide,
            width: 2 * halfSide
          };
          return boundingBox;
        }
      },
      getObjectButtonSVG: ({ classes, handleClick, objectId, objectType }) => {
        if (objectType === "dot") {
          // Find the center point
          const coords = getDotCenter(objectId);
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
        }
      },
      getObjectDefaultOffsets: (objectId: string, objectType?: string) => {
        const offsets = OffsetModel.create({});
        if (objectType === "dot") {
          offsets.setDy(-kSmallAnnotationNodeRadius);
        }
        return offsets;
      },
      getObjectNodeRadii: (objectId: string, objectType?: string) => {
        if (objectType === "dot") {
          return {
            centerRadius: kSmallAnnotationNodeRadius / 2,
            highlightRadius: kSmallAnnotationNodeRadius
          };
        }
      }
    });
    // xDomain and yDomain are included to force updating the sparrow locations when they change
  }, [getDotCenter, content, layout, onRegisterTileApi, xDomain, yDomain]);

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
