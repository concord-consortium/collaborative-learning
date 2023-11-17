import React, { useEffect, useRef } from "react";
import { observer } from "mobx-react";
import {AttributeType} from "../../../../models/data/attribute";
import { GraphPlace } from "../../imports/components/axis-graph-shared";
import { useGraphLayoutContext } from "../../models/graph-layout";
import { IDataSet } from "../../../../models/data/data-set";
import { useInstanceIdContext } from "../../imports/hooks/use-instance-id-context";
import { axisPlaceToAttrRole, kGraphDefaultHeight } from "../../graph-types";
import { useGraphModelContext } from "../../models/graph-model";

export const kMultiLegendMenuHeight = 30;
export const kMultiLegendPadding = 20;
export const kMultiLegendVerticalGap = 10;
export const kMultiLegendLabelHeight = 20;

import "./multi-legend.scss";
import { LayerLegend } from "./layer-legend";
import { IGraphLayerModel } from "../../models/graph-layer-model";
import { SimpleAttributeLabel } from "../simple-attribute-label";

interface IMultiLegendProps {
  graphElt: HTMLDivElement | null;
  onChangeAttribute: (place: GraphPlace, dataSet: IDataSet, attrId: string, oldAttrId?: string) => void;
  onRemoveAttribute: (place: GraphPlace, attrId: string) => void;
  onTreatAttributeAs: (place: GraphPlace, attrId: string, treatAs: AttributeType) => void;
  onRequestRowHeight?: (id: string, size: number) => void;
}

export const MultiLegend = observer(function MultiLegend(props: IMultiLegendProps) {
  const {onChangeAttribute, onRemoveAttribute, onTreatAttributeAs, onRequestRowHeight} = props;
  const layout = useGraphLayoutContext();
  const legendBounds = layout.computedBounds.legend;
  const transform = `translate(${legendBounds.left}, ${legendBounds.top})`;
  const multiLegendRef = useRef<HTMLDivElement>(null);
  const graphModel = useGraphModelContext();
  const instanceId = useInstanceIdContext();

  useEffect(() =>{
    const legendTransform = `translateY(${-layout.computedBounds.legend.height}px)`;
    if (!multiLegendRef.current) return;
    multiLegendRef.current.style.transform = legendTransform;
    multiLegendRef.current.style.width = `${layout.graphWidth}px`;
    multiLegendRef.current.style.height = `${legendBounds.height}px`;
  }, [layout.computedBounds.legend.height, layout.graphWidth, legendBounds, transform]);

  function heightOfLayerLegend(layer: IGraphLayerModel) {
    const yAttributeCount = layer.config.yAttributeDescriptions.length || 0;
    const legendRows = Math.ceil((yAttributeCount+1)/2);
    return kMultiLegendPadding * 2
      + kMultiLegendLabelHeight
      + kMultiLegendMenuHeight * legendRows
      + kMultiLegendVerticalGap * (legendRows - 1);
  }
  const totalHeight = graphModel.layers.reduce((prev, layer)=>{ return prev + heightOfLayerLegend(layer);}, 0);

  const thisRole = axisPlaceToAttrRole.bottom;
  const attrId = graphModel.layers[0].config?.attributeID(thisRole);

  useEffect(function RespondToLayoutChange() {
    layout.setDesiredExtent("legend", totalHeight);
    onRequestRowHeight?.(instanceId, kGraphDefaultHeight + totalHeight);
  }, [instanceId, layout, onRequestRowHeight, totalHeight]);

  const layerLegends = graphModel.layers.map((layer) => {
    return (
      <LayerLegend layer={layer}
        key={layer.id}
        onChangeAttribute={onChangeAttribute}
        onRemoveAttribute={onRemoveAttribute}
        onTreatAttributeAs={onTreatAttributeAs} />); });

  return (
    <>
      <div className="x-axis-menu">
        {/* TODO - make this succeed in showing */}
        { attrId &&
          <SimpleAttributeLabel
            place="bottom"
            key={graphModel.layers[0].id}
            attrId={attrId}
            layer={graphModel.layers[0]}
            onChangeAttribute={onChangeAttribute}
            onRemoveAttribute={onRemoveAttribute}
            onTreatAttributeAs={onTreatAttributeAs}
          />
        }
      </div>
      <div className="multi-legend" ref={ multiLegendRef }>
        { layerLegends }
      </div>
    </>
  );
});
