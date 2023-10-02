import React, { useEffect, useRef } from "react";
import { observer } from "mobx-react";
import {AttributeType} from "../../../../models/data/attribute";
import { GraphPlace } from "../../imports/components/axis-graph-shared";
import { SimpleAttributeLabel } from "../simple-attribute-label";
import { useGraphLayoutContext } from "../../models/graph-layout";
import { IDataSet } from "../../../../models/data/data-set";
import { useDataConfigurationContext } from "../../hooks/use-data-configuration-context";
import { AddSeriesButton } from "./add-series-button";

interface IMultiLegendProps {
  graphElt: HTMLDivElement | null
  onChangeAttribute: (place: GraphPlace, dataSet: IDataSet, attrId: string) => void;
  onRemoveAttribute: (place: GraphPlace, attrId: string) => void
  onTreatAttributeAs: (place: GraphPlace, attrId: string, treatAs: AttributeType) => void
}

export const MultiLegend = observer(function MultiLegend(props: IMultiLegendProps) {
  console.log("-----<MultiLegend>--------");
  const {onChangeAttribute, onRemoveAttribute, onTreatAttributeAs} = props;
  const layout = useGraphLayoutContext();
  const legendBounds = layout.computedBounds.legend;
  const transform = `translate(${legendBounds.left}, ${legendBounds.top})`;
  const multiLegendRef = useRef<HTMLDivElement>(null);

  useEffect(() =>{
    const legendTransform = `translateY(${-layout.computedBounds.legend.height}px)`;
    if (!multiLegendRef.current) return;
    multiLegendRef.current.style.transform = legendTransform;
    multiLegendRef.current.style.width = `${layout.graphWidth}px`;
    multiLegendRef.current.style.height = `${legendBounds.height}px`;
  }, [layout.graphWidth, legendBounds, transform]);

  const dataConfiguration = useDataConfigurationContext();
  let pulldowns = null;
  if (dataConfiguration) {
    const yAttributes = dataConfiguration.yAttributeDescriptions;

    pulldowns = yAttributes.map((description, index) =>
      <SimpleAttributeLabel
        key={description.attributeID}
        place={'left'}
        index={index}
        attrId={description.attributeID}
        onChangeAttribute={onChangeAttribute}
        onRemoveAttribute={onRemoveAttribute}
        onTreatAttributeAs={onTreatAttributeAs}
      />);
  }
  return (
    <div className="multi-legend" ref={ multiLegendRef }>
      {pulldowns}
      <AddSeriesButton/>
    </div>
  );
});

// MultiLegend.displayName = "MultiLegend";
