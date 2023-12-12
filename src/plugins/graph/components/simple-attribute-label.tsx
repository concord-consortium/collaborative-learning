import React, { useContext, useState} from "react";
import {observer} from "mobx-react-lite";
import {GraphPlace } from "../imports/components/axis-graph-shared";
import {AttributeType} from "../../../models/data/attribute";
import {AxisOrLegendAttributeMenu} from "../imports/components/axis/components/axis-or-legend-attribute-menu";
import { useDataConfigurationContext } from "../hooks/use-data-configuration-context";
import { useGraphModelContext } from "../models/graph-model";
import { IDataSet } from "../../../models/data/data-set";
import { kGraphClassSelector } from "../graph-types";
import { ReadOnlyContext } from "../../../components/document/read-only-context";

import "../components/legend/multi-legend.scss";

interface ISimpleAttributeLabelProps {
  place: GraphPlace;
  index?: number;
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
    const documentElt = simpleLabelElement?.closest('.document-content') as HTMLDivElement ?? null;
    const graphElement = simpleLabelElement?.closest(kGraphClassSelector) as HTMLDivElement ?? null;
    const graphModel = useGraphModelContext();
    const dataConfiguration = useDataConfigurationContext();
    const dataset = dataConfiguration?.dataset;
    const pointColor = index !== undefined && graphModel.pointColorAtIndex(index);

    const readOnly = useContext(ReadOnlyContext);

    const handleOpenClose = (isOpen: boolean) => {
      simpleLabelElement?.classList.toggle("target-open", isOpen);
      simpleLabelElement?.classList.toggle("target-closed", !isOpen);
    };

    if (onChangeAttribute && onTreatAttributeAs && onRemoveAttribute && attrId) {
      return  (
        <AxisOrLegendAttributeMenu
          setButtonElement={setSimpleLabelElement}
          pointColor={pointColor || undefined}
          target={null}
          parent={graphElement}
          portal={documentElt}
          place={place}
          attributeId={attrId}
          highlighted={dataset?.isAttributeSelected(attrId)}
          readOnly={readOnly}
          onChangeAttribute={onChangeAttribute}
          onRemoveAttribute={onRemoveAttribute}
          onTreatAttributeAs={onTreatAttributeAs}
          onOpenClose={handleOpenClose}
        />
      );
    }
    return null;
  });
SimpleAttributeLabel.displayName = "SimpleAttributeLabel";
