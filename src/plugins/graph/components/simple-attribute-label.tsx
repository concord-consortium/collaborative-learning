import React, { useContext, useState} from "react";
import {createPortal} from "react-dom";
import {observer} from "mobx-react-lite";
import {GraphPlace } from "../imports/components/axis-graph-shared";
import {AttributeType} from "../../../models/data/attribute";
import {AxisOrLegendAttributeMenu} from "../imports/components/axis/components/axis-or-legend-attribute-menu";
import { useDataConfigurationContext } from "../hooks/use-data-configuration-context";
import { useGraphModelContext } from "../models/graph-model";
import { IDataSet } from "../../../models/data/data-set";
import { kGraphClassSelector } from "../graph-types";
import { ReadOnlyContext } from "../../../components/document/read-only-context";

import DropdownCaretIcon from "../dropdown-caret.svg";

import "../components/legend/multi-legend.scss";

interface ISimpleAttributeLabelProps {
  place: GraphPlace;
  index: number;
  attrId: string;
  onChangeAttribute?: (place: GraphPlace, dataSet: IDataSet, attrId: string, oldAttrId?: string) => void;
  onRemoveAttribute?: (place: GraphPlace, attrId: string) => void;
  onTreatAttributeAs?: (place: GraphPlace, attrId: string, treatAs: AttributeType) => void;
}

export const SimpleAttributeLabel = observer(
  function SimpleAttributeLabel(props: ISimpleAttributeLabelProps) {
    const { place, index, attrId, onTreatAttributeAs, onRemoveAttribute, onChangeAttribute } = props;
    // Must be State, not Ref, so that the menu gets re-rendered when this becomes non-null
    const [simpleLabelElement, setSimpleLabelElement] = useState<HTMLDivElement|null>(null);
    const graphElement = simpleLabelElement?.closest(kGraphClassSelector) as HTMLDivElement ?? null;
    const dataConfiguration = useDataConfigurationContext();
    const dataset = dataConfiguration?.dataset;
    const graphModel = useGraphModelContext();
    const attr = attrId ? dataset?.attrFromID(attrId) : undefined;
    const attrName = attr?.name ?? "";
    const pointColor = graphModel.pointColorAtIndex(index);

    const readOnly = useContext(ReadOnlyContext);

    const handleOpenClose = (isOpen: boolean) => {
      simpleLabelElement?.classList.toggle("target-open", isOpen);
      simpleLabelElement?.classList.toggle("target-closed", !isOpen);
    };

    return (
      <>
        <div ref={(e) => setSimpleLabelElement(e)} className={"simple-attribute-label"}>
          <div className="symbol-title">
            <div className="attr-symbol" style={{ backgroundColor: pointColor }}></div>
            <div>{ attrName }</div>
          </div>
          {!readOnly &&
            <div className="caret">
              <DropdownCaretIcon />
            </div>
          }
        </div>
        {!readOnly && simpleLabelElement && graphElement && onChangeAttribute
            && onTreatAttributeAs && onRemoveAttribute && attrId &&
          createPortal(<AxisOrLegendAttributeMenu
            target={simpleLabelElement}
            portal={graphElement}
            place={place}
            attributeId={attrId}
            onChangeAttribute={onChangeAttribute}
            onRemoveAttribute={onRemoveAttribute}
            onTreatAttributeAs={onTreatAttributeAs}
            onOpenClose={handleOpenClose}
          />, graphElement)
        }
      </>
    );
  });
SimpleAttributeLabel.displayName = "SimpleAttributeLabel";
