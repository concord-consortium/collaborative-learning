import { observer } from "mobx-react-lite";
import React from "react";

import { axisPlaceToAttrRole } from "../../graph-types";
import { DataConfigurationContext } from "../../hooks/use-data-configuration-context";
import { useGraphModelContext } from "../../hooks/use-graph-model-context";
import { SimpleAttributeLabel } from "../simple-attribute-label";
import { kMultiLegendMenuHeight, kMultiLegendVerticalPadding } from "./legend-constants";
import { ILegendHeightFunctionProps, ILegendPartProps } from "./legend-types";

export const codapXLegendType = "codap-x-legend";

export const CodapXLegend = observer(function CodapXLegend({
  onChangeAttribute, onRemoveAttribute, onTreatAttributeAs
}: ILegendPartProps) {
  const graphModel = useGraphModelContext();
  const bottomRole = axisPlaceToAttrRole.bottom;

  return (
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
});

export function heightOfCodapXLegend({ graphModel }: ILegendHeightFunctionProps) {
  return kMultiLegendMenuHeight + kMultiLegendVerticalPadding;
}
