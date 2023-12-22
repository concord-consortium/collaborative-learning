import React, { useState} from "react";
import {observer} from "mobx-react-lite";
import {GraphPlace } from "../imports/components/axis-graph-shared";
import {AttributeType} from "../../../models/data/attribute";
import {AxisOrLegendAttributeMenu} from "../imports/components/axis/components/axis-or-legend-attribute-menu";
import { useDataConfigurationContext } from "../hooks/use-data-configuration-context";
import { useGraphModelContext } from "../hooks/use-graph-model-context";
import { IDataSet } from "../../../models/data/data-set";
import { kGraphClassSelector } from "../graph-types";

import "../components/legend/multi-legend.scss";

interface ISimpleAttributeLabelProps {
  attrId: string;
  includePoint?: boolean;
  onChangeAttribute?: (place: GraphPlace, dataSet: IDataSet, attrId: string, oldAttrId?: string) => void;
  onRemoveAttribute?: (place: GraphPlace, attrId: string) => void;
  onTreatAttributeAs?: (place: GraphPlace, attrId: string, treatAs: AttributeType) => void;
  place: GraphPlace;
}

export const SimpleAttributeLabel = observer(
  function SimpleAttributeLabel(props: ISimpleAttributeLabelProps) {
    const { attrId, includePoint, onTreatAttributeAs, onRemoveAttribute, onChangeAttribute, place } = props;
    // Must be State, not Ref, so that the menu gets re-rendered when this becomes non-null
    const [simpleLabelElement, setSimpleLabelElement] = useState<HTMLSpanElement|null>(null);
    const documentElt = simpleLabelElement?.closest('.document-content') as HTMLDivElement ?? null;
    const graphElement = simpleLabelElement?.closest(kGraphClassSelector) as HTMLDivElement ?? null;
    const graphModel = useGraphModelContext();
    const dataConfiguration = useDataConfigurationContext();
    const dataset = dataConfiguration?.dataset;
    const pointColor = includePoint && graphModel.getColorForId(attrId);

    if (onChangeAttribute && onTreatAttributeAs && onRemoveAttribute && attrId) {
      return  (
        <span ref={e => setSimpleLabelElement(e)}>
          <AxisOrLegendAttributeMenu
            pointColor={pointColor || undefined}
            target={null}
            parent={graphElement}
            portal={documentElt}
            place={place}
            attributeId={attrId}
            highlighted={dataset?.isAttributeSelected(attrId)}
            onChangeAttribute={onChangeAttribute}
            onRemoveAttribute={onRemoveAttribute}
            onTreatAttributeAs={onTreatAttributeAs}
          />
        </span>
      );
    }
    return null;
  });
SimpleAttributeLabel.displayName = "SimpleAttributeLabel";
