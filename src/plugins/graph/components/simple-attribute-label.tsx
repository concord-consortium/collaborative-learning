import React, {useRef} from "react";
import {createPortal} from "react-dom";
import {observer} from "mobx-react-lite";
import {GraphPlace } from "../imports/components/axis-graph-shared";
import {AttributeType} from "../../../models/data/attribute";
import {AxisOrLegendAttributeMenu} from "../imports/components/axis/components/axis-or-legend-attribute-menu";
import { graphPlaceToAttrRole } from "../graph-types";

import "../components/legend/multi-legend.scss";

interface ISimpleAttributeLabelProps {
  attrId: string
  place: any
  onChangeAttribute?: (place: GraphPlace, attrId: string) => void
  onRemoveAttribute?: (place: GraphPlace, attrId: string) => void
  onTreatAttributeAs?: (place: GraphPlace, attrId: string, treatAs: AttributeType) => void
}

export const SimpleAttributeLabel = observer(
  function SimpleAttributeLabel(props: ISimpleAttributeLabelProps) {
    const {attrId, place, onTreatAttributeAs, onRemoveAttribute, onChangeAttribute} = props;
    const simpleLabelRef = useRef<HTMLDivElement>(null);
    const parentElt = simpleLabelRef.current?.closest('.document-content') as HTMLDivElement ?? null;

    return (
      <>
        <div ref={simpleLabelRef} className="simple-attribute-label">attr_name_here</div>
        {parentElt &&
          createPortal(<AxisOrLegendAttributeMenu
            target={simpleLabelRef.current}
            portal={parentElt}
            place={place}
            onChangeAttribute={onChangeAttribute as any}
            onRemoveAttribute={onRemoveAttribute as any}
            onTreatAttributeAs={onTreatAttributeAs as any}
          />, parentElt)
        }
      </>
    );
  });
SimpleAttributeLabel.displayName = "SimpleAttributeLabel";
