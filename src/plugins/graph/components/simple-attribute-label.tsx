import React, {useRef} from "react";
import {createPortal} from "react-dom";
import {observer} from "mobx-react-lite";
import {GraphPlace } from "../imports/components/axis-graph-shared";
import {AttributeType} from "../../../models/data/attribute";
import {kGraphClassSelector} from "../graph-types";
import {AxisOrLegendAttributeMenu} from "../imports/components/axis/components/axis-or-legend-attribute-menu";


import "../components/legend/multi-legend.scss";

interface ISimpleAttributeLabelProps {
  place: GraphPlace
  onChangeAttribute?: (place: GraphPlace, attrId: string) => void
  onRemoveAttribute?: (place: GraphPlace, attrId: string) => void
  onTreatAttributeAs?: (place: GraphPlace, attrId: string, treatAs: AttributeType) => void
}

export const SimpleAttributeLabel = observer(
  function SimpleAttributeLabel(props: ISimpleAttributeLabelProps) {
    const {place, onTreatAttributeAs, onRemoveAttribute, onChangeAttribute} = props;
    const simpleLabelRef = useRef<HTMLDivElement>(null); //useRef<HTMLDivElement>(null);
    const parentElt = simpleLabelRef.current?.closest(kGraphClassSelector) as HTMLDivElement ?? null;

    return (
      <>
        <div ref={simpleLabelRef} className="simple-attribute-label">some_attribute</div>
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
