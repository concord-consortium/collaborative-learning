import React, { useEffect, useRef } from "react";
import { observer } from "mobx-react";
import { AttributeType } from "../../../../models/data/attribute";
import { GraphPlace } from "../../imports/components/axis-graph-shared";
import { useGraphLayoutContext } from "../../models/graph-layout";
import { IDataSet } from "../../../../models/data/data-set";
import { DataConfigurationContext } from "../../hooks/use-data-configuration-context";
import { useInstanceIdContext } from "../../imports/hooks/use-instance-id-context";
import { axisPlaceToAttrRole, kGraphDefaultHeight } from "../../graph-types";
import { useGraphModelContext } from "../../models/graph-model";
import { LayerLegend } from "./layer-legend";
import { IGraphLayerModel } from "../../models/graph-layer-model";
import { SimpleAttributeLabel } from "../simple-attribute-label";
import { VariableFunctionLegend } from "./variable-function-legend";

import "./multi-legend.scss";

const kMultiLegendMenuHeight = 30;
const kMultiLegendVerticalPadding = 10;
const kMultiLegendVerticalGap = 8;
const kMultiLegendLabelHeight = 28;
const kMultiLegendHRuleHeight = 2;
const kTemporarySpaceForVariablesLegend = 30; // TODO: actually calculate height for variables legend

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
    // Menu for each Y attribute, plus one for "Add series" button
    const menuCount = (layer.config.yAttributeDescriptions.length || 0) + 1;
    const legendRows = Math.ceil(menuCount/2);
    return kMultiLegendHRuleHeight
      + kMultiLegendVerticalPadding * 3 // above title, below title, below all.
      + kMultiLegendLabelHeight
      + kMultiLegendMenuHeight * legendRows
      + kMultiLegendVerticalGap * legendRows * 2; // above each row
  }
  // Total height is height of X-axis menus, plus sum of all the layer sections
  const totalHeight = kMultiLegendMenuHeight + kMultiLegendVerticalPadding
    + kTemporarySpaceForVariablesLegend
    + graphModel.layers.reduce((prev, layer)=>{ return prev + heightOfLayerLegend(layer);}, 0);

  useEffect(function RespondToLayoutChange() {
    layout.setDesiredExtent("legend", totalHeight);
    onRequestRowHeight?.(instanceId, kGraphDefaultHeight + totalHeight);
  }, [instanceId, layout, onRequestRowHeight, totalHeight]);

  const layerLegends = graphModel.layers.map((layer) => {
    return (
      <DataConfigurationContext.Provider key={layer.id} value={layer.config}>
        <LayerLegend
          onChangeAttribute={onChangeAttribute}
          onRemoveAttribute={onRemoveAttribute}
          onTreatAttributeAs={onTreatAttributeAs}
        />
      </DataConfigurationContext.Provider>);
    }
  );

  const thisRole = axisPlaceToAttrRole.bottom;

  const xMenus = graphModel.layers.map((layer) => {
    const attrId = layer.config?.attributeID(thisRole);
    if (!attrId) return;

    return (
      <div className="x-axis-item" key={layer.id}>
        <DataConfigurationContext.Provider value={layer.config}>
          <SimpleAttributeLabel
            place="bottom"
            attrId={attrId}
            onChangeAttribute={onChangeAttribute}
            onRemoveAttribute={onRemoveAttribute}
            onTreatAttributeAs={onTreatAttributeAs}
          />
        </DataConfigurationContext.Provider>
      </div>
    );
  });

  return (
    <div className="multi-legend" ref={ multiLegendRef }>
      <div className="x-axis-menu">
        { xMenus }
      </div>
      { layerLegends }
      <VariableFunctionLegend/>
    </div>
  );
});
