import React, {useRef} from "react";
import {createPortal} from "react-dom";
import {observer} from "mobx-react-lite";
import {GraphPlace } from "../imports/components/axis-graph-shared";
import {AttributeType} from "../../../models/data/attribute";
import {AxisOrLegendAttributeMenu} from "../imports/components/axis/components/axis-or-legend-attribute-menu";
import { graphPlaceToAttrRole, kGraphClassSelector } from "../graph-types";
import { useDataConfigurationContext } from "../hooks/use-data-configuration-context";
import { useGraphModelContext } from "../models/graph-model";
import { IDataSet } from "../../../models/data/data-set";
import DropdownCaretIcon from "../dropdown-caret.svg";

import "../components/legend/multi-legend.scss";

interface ISimpleAttributeLabelProps {
  place: GraphPlace,
  onChangeAttribute?: (place: GraphPlace, dataSet: IDataSet, attrId: string) => void
  onRemoveAttribute?: (place: GraphPlace, attrId: string) => void
  onTreatAttributeAs?: (place: GraphPlace, attrId: string, treatAs: AttributeType) => void
}

export const SimpleAttributeLabel = observer(
  function SimpleAttributeLabel(props: ISimpleAttributeLabelProps) {
    const {place, onTreatAttributeAs, onRemoveAttribute, onChangeAttribute} = props;
    const simpleLabelRef = useRef<HTMLDivElement>(null);
    const parentElt = simpleLabelRef.current?.closest(kGraphClassSelector) as HTMLDivElement ?? null;
    const dataConfiguration = useDataConfigurationContext();
    const dataset = dataConfiguration?.dataset;
    const graphModel = useGraphModelContext();
    const attrId = dataConfiguration?.attributeID(graphPlaceToAttrRole[place]);
    const attr = attrId ? dataset?.attrFromID(attrId) : undefined;
    const attrName = attr?.name ?? "";
    const pointColor = graphModel._pointColors[0]; // In PT#182578812 will pass plotIndex

    return (
      <>
        <div ref={simpleLabelRef} className="simple-attribute-label">
          <div className="symbol-title">
            <div className="attr-symbol" style={{ backgroundColor: pointColor }}></div>
            <div>{ attrName }</div>
          </div>
          <div className="caret">
            <DropdownCaretIcon />
          </div>
        </div>
        {parentElt && onChangeAttribute && onTreatAttributeAs && onRemoveAttribute && attrId &&
          createPortal(<AxisOrLegendAttributeMenu
            target={simpleLabelRef.current}
            portal={parentElt}
            place={place}
            onChangeAttribute={onChangeAttribute}
            onRemoveAttribute={onRemoveAttribute}
            onTreatAttributeAs={onTreatAttributeAs}
          />, parentElt)
        }
      </>
    );
  });
SimpleAttributeLabel.displayName = "SimpleAttributeLabel";
