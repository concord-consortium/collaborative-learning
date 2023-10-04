import React, {useRef} from "react";
import {createPortal} from "react-dom";
import {observer} from "mobx-react-lite";
import {GraphPlace } from "../imports/components/axis-graph-shared";
import {AttributeType} from "../../../models/data/attribute";
import {AxisOrLegendAttributeMenu} from "../imports/components/axis/components/axis-or-legend-attribute-menu";
import { kGraphClassSelector } from "../graph-types";
import { useDataConfigurationContext } from "../hooks/use-data-configuration-context";
import { useGraphModelContext } from "../models/graph-model";
import { IDataSet } from "../../../models/data/data-set";
import DropdownCaretIcon from "../dropdown-caret.svg";

import "../components/legend/multi-legend.scss";

interface ISimpleAttributeLabelProps {
  place: GraphPlace
  index: number
  attrId: string
  onChangeAttribute?: (place: GraphPlace, dataSet: IDataSet, attrId: string, oldAttrId?: string) => void
  onRemoveAttribute?: (place: GraphPlace, attrId: string) => void
  onTreatAttributeAs?: (place: GraphPlace, attrId: string, treatAs: AttributeType) => void
}

export const SimpleAttributeLabel = observer(
  function SimpleAttributeLabel(props: ISimpleAttributeLabelProps) {

    // console.log("📁 simple-attribute-label.tsx ------------------------");
    // console.log("\t🥩 SimpleAttributeLabel:", SimpleAttributeLabel);
    // console.log("\t🥩 props:", props);


    const {place, index, attrId, onTreatAttributeAs, onRemoveAttribute, onChangeAttribute} = props;
    const simpleLabelRef = useRef<HTMLDivElement>(null);
    const parentElt = simpleLabelRef.current?.closest(kGraphClassSelector) as HTMLDivElement ?? null;
    const dataConfiguration = useDataConfigurationContext();
    const dataset = dataConfiguration?.dataset;
    const graphModel = useGraphModelContext();
    const attr = attrId ? dataset?.attrFromID(attrId) : undefined;
    const attrName = attr?.name ?? "";
    const pointColor = graphModel.pointColorAtIndex(index);

    const handleOpenClose = (isOpen: boolean) => {
      simpleLabelRef.current?.classList.toggle("target-open", isOpen);
      simpleLabelRef.current?.classList.toggle("target-closed", !isOpen);
    };

    return (
      <>
        <div ref={simpleLabelRef} className={"simple-attribute-label"}>
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
            attributeId={attrId}
            onChangeAttribute={onChangeAttribute}
            onRemoveAttribute={onRemoveAttribute}
            onTreatAttributeAs={onTreatAttributeAs}
            onOpenClose={handleOpenClose}
          />, parentElt)
        }
      </>
    );
  });
SimpleAttributeLabel.displayName = "SimpleAttributeLabel";
