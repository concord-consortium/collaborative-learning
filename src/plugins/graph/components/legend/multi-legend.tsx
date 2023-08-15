import React, {useRef} from "react";
import {AttributeType} from "../../../../models/data/attribute";
import { GraphPlace } from "../../imports/components/axis-graph-shared";
import { SimpleAttributeLabel } from "../simple-attribute-label";
import { useInstanceIdContext } from "../../imports/hooks/use-instance-id-context";

interface IMultiLegendProps {
  graphElt: HTMLDivElement | null
  onChangeAttribute: (place: GraphPlace, attrId: string) => void
  onRemoveAttribute: (place: GraphPlace, attrId: string) => void
  onTreatAttributeAs: (place: GraphPlace, attrId: string, treatAs: AttributeType) => void
}

export const MultiLegend = function MultiLegend(props: IMultiLegendProps) {
  const {onChangeAttribute, onRemoveAttribute, onTreatAttributeAs} = props;
  const multiLegendRef = useRef() as React.RefObject<SVGSVGElement>;
  const instanceId = useInstanceIdContext();

  return (
    // <svg ref={multiLegendRef} className='multi-legend-component'>
      <SimpleAttributeLabel
        place={'left'}
        onChangeAttribute={onChangeAttribute}
        onRemoveAttribute={onRemoveAttribute}
        onTreatAttributeAs={onTreatAttributeAs}
      />
    // </svg>
  );
};
MultiLegend.displayName = "MultiLegend";
