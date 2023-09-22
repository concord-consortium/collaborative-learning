import React, { useEffect, useRef } from "react";
import { AttributeType } from "../../../../models/data/attribute";
import { GraphPlace } from "../../imports/components/axis-graph-shared";
import { SimpleAttributeLabel } from "../simple-attribute-label";
import { kMultiLegendHeight, useGraphLayoutContext } from "../../models/graph-layout";
import { IDataSet } from "../../../../models/data/data-set";

interface IMultiLegendProps {
  graphElt: HTMLDivElement | null
  onChangeAttribute: (place: GraphPlace, dataSet: IDataSet, attrId: string) => void;
  onRemoveAttribute: (place: GraphPlace, attrId: string) => void
  onTreatAttributeAs: (place: GraphPlace, attrId: string, treatAs: AttributeType) => void
}

export const MultiLegend = function MultiLegend(props: IMultiLegendProps) {
  const { onChangeAttribute, onRemoveAttribute, onTreatAttributeAs } = props;
  const layout = useGraphLayoutContext();
  const legendBounds = layout.computedBounds.legend;
  const transform = `translate(${legendBounds.left}, ${legendBounds.top})`;
  const multiLegendRef = useRef<HTMLDivElement>(null);

  useEffect(() =>{
    const legendTransform = `translateY(${ 0 - (kMultiLegendHeight + 3)}px)`;
    if (!multiLegendRef.current) return;
    multiLegendRef.current.style.transform = legendTransform;
    multiLegendRef.current.style.width = `${layout.graphWidth}px`;
    multiLegendRef.current.style.height = `${legendBounds.height}px`;
  }, [layout.graphWidth, legendBounds, transform]);

  return (
    <div className="multi-legend" ref={ multiLegendRef }>
      <SimpleAttributeLabel
        place={'left'}
        onChangeAttribute={onChangeAttribute}
        onRemoveAttribute={onRemoveAttribute}
        onTreatAttributeAs={onTreatAttributeAs}
      />
    </div>
  );
};
MultiLegend.displayName = "MultiLegend";
