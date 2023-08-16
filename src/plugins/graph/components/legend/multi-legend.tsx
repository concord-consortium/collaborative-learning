import React from "react";
import {AttributeType} from "../../../../models/data/attribute";
import { GraphPlace } from "../../imports/components/axis-graph-shared";
import { SimpleAttributeLabel } from "../simple-attribute-label";
// import { kMultiLegendHeight, useGraphLayoutContext } from "../../models/graph-layout"; // positioning down the road
import { useDataSetContext } from "../../imports/hooks/use-data-set-context";
import { useDataConfigurationContext } from "../../hooks/use-data-configuration-context";
import { useGraphModelContext } from "../../models/graph-model";

interface IMultiLegendProps {
  graphElt: HTMLDivElement | null
  onChangeAttribute: (place: GraphPlace, attrId: string) => void
  onRemoveAttribute: (place: GraphPlace, attrId: string) => void
  onTreatAttributeAs: (place: GraphPlace, attrId: string, treatAs: AttributeType) => void
}

export const MultiLegend = function MultiLegend(props: IMultiLegendProps) {
  const {onChangeAttribute, onRemoveAttribute, onTreatAttributeAs} = props;
  //const graphLayout = useGraphLayoutContext();
  const dataSet = useDataSetContext();
  const dataConfig = useDataConfigurationContext();
  const graphModel = useGraphModelContext();
  const yAttrs = dataConfig?._yAttributeDescriptions.map(attr => attr.attributeID);

  console.log("| DATA AT HAND |\n",
    //"graphLayout:", JSON.parse(JSON.stringify(graphLayout)), "\n", // for positioning down the road
    "dataSet:    ", JSON.parse(JSON.stringify(dataSet)), "\n",
    "dataConfig: ", JSON.parse(JSON.stringify(dataConfig)), "\n",
    "graphModel: ", JSON.parse(JSON.stringify(graphModel)), "\n",
    "\n\n"
  );

const attrId = yAttrs ? yAttrs[0] : "";


  return (
    <div className="multi-legend">
        <SimpleAttributeLabel
          key={attrId}
          attrId={attrId}
          place={'left'}
          onChangeAttribute={onChangeAttribute}
          onRemoveAttribute={onRemoveAttribute}
          onTreatAttributeAs={onTreatAttributeAs}
        />
    </div>

  );
};
MultiLegend.displayName = "MultiLegend";
