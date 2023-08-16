import React, { useEffect, useRef } from "react";
import {AttributeType} from "../../../../models/data/attribute";
import { GraphPlace } from "../../imports/components/axis-graph-shared";
import { SimpleAttributeLabel } from "../simple-attribute-label";
import { autorun } from "mobx";
import { useGraphLayoutContext } from "../../models/graph-layout";

interface IMultiLegendProps {
  graphElt: HTMLDivElement | null
  onChangeAttribute: (place: GraphPlace, attrId: string) => void
  onRemoveAttribute: (place: GraphPlace, attrId: string) => void
  onTreatAttributeAs: (place: GraphPlace, attrId: string, treatAs: AttributeType) => void
}

/* NOTE: This component will have more use in PT#182578812
  in which we will get all attributes from yAttr Descriptions,
  and render a label for each
*/

export const MultiLegend = function MultiLegend(props: IMultiLegendProps) {
  const {onChangeAttribute, onRemoveAttribute, onTreatAttributeAs} = props;
  const layout = useGraphLayoutContext();
  const legendBounds = layout.computedBounds.legend;
  const transform = `translate(${legendBounds.left}, ${legendBounds.top})`;

  // TODO: this is borrowed from legend.tsx, should be abstracted for use accross legends
  useEffect(() =>{
    const legendBackground = document.querySelector('.multi-legend');
    if (legendBackground) {
      legendBackground.setAttribute('transform', `translate(0, ${legendBounds.top})`);
      legendBackground.setAttribute('width', `${layout.graphWidth}`);
      legendBackground.setAttribute('height', `${legendBounds.height}`);
    }
  }, [layout.graphWidth, legendBounds, transform]);

  return (
    <div className="multi-legend">
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
