import React, { useEffect, useRef } from "react";
import { observer } from "mobx-react";
import {AttributeType} from "../../../../models/data/attribute";
import { GraphPlace } from "../../imports/components/axis-graph-shared";
import { SimpleAttributeLabel } from "../simple-attribute-label";
import { useGraphLayoutContext } from "../../models/graph-layout";
import { IDataSet } from "../../../../models/data/data-set";
import { useDataConfigurationContext } from "../../hooks/use-data-configuration-context";
import { AddSeriesButton } from "./add-series-button";

import "./multi-legend.scss";


interface IMultiLegendProps {
  graphElt: HTMLDivElement | null
  onChangeAttribute: (place: GraphPlace, dataSet: IDataSet, attrId: string, oldAttrId?: string) => void;
  onRemoveAttribute: (place: GraphPlace, attrId: string) => void
  onTreatAttributeAs: (place: GraphPlace, attrId: string, treatAs: AttributeType) => void
}

export const MultiLegend = observer(function MultiLegend(props: IMultiLegendProps) {
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
    console.log("translateY:", -layout.computedBounds.legend.height);
    console.log("multiLegendRef.current.style.transform:", multiLegendRef.current.style.transform);
    console.log("multiLegendRef.current.style.width", multiLegendRef.current.style.width);
    console.log("multiLegendRef.current.style.height", multiLegendRef.current.style.height);
  }, [layout.computedBounds.legend.height, layout.graphWidth, legendBounds, transform]);


  const dataConfiguration = useDataConfigurationContext();
  let legendItems = [] as JSX.Element[];
  if (dataConfiguration) {
    const yAttributes = dataConfiguration.yAttributeDescriptions;

    legendItems = yAttributes.map((description, index) =>
      <SimpleAttributeLabel
        key={description.attributeID}
        place={'left'}
        index={index}
        attrId={description.attributeID}
        onChangeAttribute={onChangeAttribute}
        onRemoveAttribute={onRemoveAttribute}
        onTreatAttributeAs={onTreatAttributeAs}
      />);
    legendItems.push(<AddSeriesButton/>);
  }
  // Make rows with two legend items in each row
  const legendItemRows = [] as JSX.Element[];
  let i=0;
  console.log("\tlegendItems line 53 before while loop");
  legendItems.forEach((item)=>{
    console.log("item:",item);
  });
  while(legendItems.length) {
    legendItemRows.push(
      <div key={i++} className="legend-row">
        <div className="legend-cell-1">
          {legendItems?.shift()}
        </div>
        <div className="legend-cell-2">
          {legendItems?.shift() || null}
        </div>
      </div>
    );
  }
  console.log("\tlegendItemRows:", legendItemRows);
  console.log("\tlegendItems", legendItems);


  return (
    <div className="multi-legend" ref={ multiLegendRef }>
      {legendItemRows}
      {console.log("in render legendItemRows:", legendItemRows)}
    </div>
  );
});

// MultiLegend.displayName = "MultiLegend";
