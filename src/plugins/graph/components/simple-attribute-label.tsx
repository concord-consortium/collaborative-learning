import React, {useRef} from "react";
import {createPortal} from "react-dom";
import {observer} from "mobx-react-lite";
import {GraphPlace } from "../imports/components/axis-graph-shared";
import {AttributeType} from "../../../models/data/attribute";
import {AxisOrLegendAttributeMenu} from "../imports/components/axis/components/axis-or-legend-attribute-menu";
import { graphPlaceToAttrRole, kGraphClassSelector } from "../graph-types";
import { useDataConfigurationContext } from "../hooks/use-data-configuration-context";

import "../components/legend/multi-legend.scss";
import { useDataSetContext } from "../imports/hooks/use-data-set-context";
import { useGraphModelContext } from "../models/graph-model";


interface ISimpleAttributeLabelProps {
  place: GraphPlace
  onChangeAttribute?: (place: GraphPlace, attrId: string) => void
  onRemoveAttribute?: (place: GraphPlace, attrId: string) => void
  onTreatAttributeAs?: (place: GraphPlace, attrId: string, treatAs: AttributeType) => void
}

export const SimpleAttributeLabel = observer(
  function SimpleAttributeLabel(props: ISimpleAttributeLabelProps) {
    const {place, onTreatAttributeAs, onRemoveAttribute, onChangeAttribute} = props;
    const simpleLabelRef = useRef<HTMLDivElement>(null);
    const parentElt = simpleLabelRef.current?.closest(kGraphClassSelector) as HTMLDivElement ?? null;
    const dataSet = useDataSetContext();
    const dataConfig = useDataConfigurationContext();
    const graphModel = useGraphModelContext();
    const attrId = dataConfig?.attributeID(graphPlaceToAttrRole[place]);
    const attr = attrId ? dataSet?.attrFromID(attrId) : undefined;
    const attrName = attr?.name ?? "";
    const pointColor = graphModel._pointColors[0]; // In PT#182578812 will be dynamic based on plotIndex

    const symbolStyles = {
      backgroundColor: pointColor,
      width: '15px',
      height: '15px',
      borderRadius: '50%',
      marginRight: '5px',
      transform: 'translate(-2px, 3px)'
    };

    return (
      <>
        <div ref={simpleLabelRef} className="simple-attribute-label">
          <div className="attr-symbol" style={symbolStyles}></div>
          <div className="attr-name"> { attrName }</div>
        </div>
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
