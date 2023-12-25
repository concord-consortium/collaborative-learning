import React, { useEffect, useRef } from "react";
import { observer } from "mobx-react";
import { AttributeType } from "../../../../models/data/attribute";
import { GraphPlace } from "../../imports/components/axis-graph-shared";
import { useGraphLayoutContext } from "../../models/graph-layout";
import { IDataSet } from "../../../../models/data/data-set";
import {
  IPlottedVariablesAdornmentModel, isPlottedVariablesAdornment
} from "../../adornments/plotted-function/plotted-variables/plotted-variables-adornment-model";
import { DataConfigurationContext } from "../../hooks/use-data-configuration-context";
import { useGraphSettingsContext } from "../../hooks/use-graph-settings-context";
import { useInstanceIdContext } from "../../imports/hooks/use-instance-id-context";
import { axisPlaceToAttrRole, kGraphDefaultHeight } from "../../graph-types";
import { useGraphModelContext } from "../../hooks/use-graph-model-context";
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
const kPlottedVariableHeader = 40;
const kPlottedVariableRow = 46;

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
  const { defaultSeriesLegend } = useGraphSettingsContext();

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
  function heightOfLayers() {
    return graphModel.layers.reduce((prev, layer)=>{ return prev + heightOfLayerLegend(layer);}, 0);
  }
  function heightOfPlottedVariablesLegend() {
    const plottedVariableAdornments = graphModel.adornments
      .filter(adornment => isPlottedVariablesAdornment(adornment)) as IPlottedVariablesAdornmentModel[];
    const plottedVariableTraces = plottedVariableAdornments.reduce((prev, adornment) => {
      return adornment.plottedVariables.size;
    }, 0);
    // Each adornment has a header and an add variable row, plus one row for each plot
    return plottedVariableAdornments.length * (kPlottedVariableHeader + kPlottedVariableRow)
      + plottedVariableTraces * kPlottedVariableRow;
  }
  // Total height is height of X-axis menus, plus sum of all the plotted data and variable sections
  const xMenuHeight = defaultSeriesLegend ? 0 : kMultiLegendMenuHeight + kMultiLegendVerticalPadding;
  // TODO Remove this extra buffer space to make sure the whole legend can be seen before refactoring height calculation
  const extraHeight = 100;
  const totalHeight = extraHeight + xMenuHeight
    + heightOfLayers()
    + heightOfPlottedVariablesLegend();

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

  const bottomRole = axisPlaceToAttrRole.bottom;

  const xMenus = defaultSeriesLegend ? null : (
    <div className="x-axis-menu">
      {
        graphModel.layers.map((layer) => {
          const attrId = layer.config?.attributeID(bottomRole);
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
        })
      }
    </div>
  );

  return (
    <div className="multi-legend" ref={ multiLegendRef }>
      { xMenus }
      { layerLegends }
      {
        graphModel.adornments.map(adornment => {
          if (isPlottedVariablesAdornment(adornment)) {
            return (
              <VariableFunctionLegend
                key={adornment.id}
                plottedVariablesAdornment={adornment}
              />
            );
          }
          return null;
        })
      }
    </div>
  );
});
