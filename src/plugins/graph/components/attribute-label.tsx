import classNames from "classnames";
import React, {useCallback, useEffect, useRef, useState} from "react";
import {observer} from "mobx-react-lite";
import t from "../imports/utilities/translation/translate";
import {useDataConfigurationContext} from "../hooks/use-data-configuration-context";
import { defaultFont } from "../../../components/constants";
import { useReadOnlyContext } from "../../../components/document/read-only-context";
import {AttributeType} from "../../../models/data/attribute";
import {IDataSet} from "../../../models/data/data-set";
import {
  graphPlaceToAttrRole, kAxisLabelBorderWidth, kAxisLabelHorizontalPadding, kAxisLabelVerticalPadding,
  kGraphClassSelector, kGraphPortalClass
} from "../graph-types";
import { useGraphModelContext } from "../hooks/use-graph-model-context";
import { axisGap } from "../imports/components/axis/axis-types";
import { GraphPlace, isVertical } from "../imports/components/axis-graph-shared";
import { useGraphLayoutContext } from "../models/graph-layout";
import {getStringBounds} from "../imports/components/axis/axis-utils";
import {AxisOrLegendAttributeMenu} from "../imports/components/axis/components/axis-or-legend-attribute-menu";
import { useGraphSettingsContext } from "../hooks/use-graph-settings-context";
import { InputTextbox } from "./input-textbox";

import "./attribute-label.scss";

interface IAttributeLabelProps {
  place: GraphPlace;
  onChangeAttribute?: (place: GraphPlace, dataSet: IDataSet, attrId: string) => void;
  onRemoveAttribute?: (place: GraphPlace, attrId: string) => void;
  onTreatAttributeAs?: (place: GraphPlace, attrId: string, treatAs: AttributeType) => void;
}

export const AttributeLabel = observer(
  function AttributeLabel({place, onTreatAttributeAs, onRemoveAttribute, onChangeAttribute}: IAttributeLabelProps) {
    const graphModel = useGraphModelContext(),
      dataConfiguration = useDataConfigurationContext(),
      { defaultSeriesLegend, defaultAxisLabels } = useGraphSettingsContext(),
      layout = useGraphLayoutContext(),
      readOnly = useReadOnlyContext(),
      dataset = dataConfiguration?.dataset,
      useClickHereCue = dataConfiguration?.placeCanShowClickHereCue(place) ?? false,
      [editing, setEditing] = useState(false),
      inputRef = useRef<HTMLInputElement | null>(null),
      [inputWidth, setInputWidth] = useState(0),
      [labelElt, setLabelElt] = useState<HTMLDivElement | null>(null),
      portalParentElt = labelElt?.closest(kGraphPortalClass) as HTMLDivElement ?? null,
      positioningParentElt = labelElt?.closest(kGraphClassSelector) as HTMLDivElement ?? null;

    useEffect(() => {
      if (editing && inputRef.current) {
        inputRef.current.select();
      }
    }, [editing]);

    const getAttributeIDs = useCallback(() => {
      const isScatterPlot = graphModel.plotType === 'scatterPlot',
        yAttributeDescriptions = dataConfiguration?.yAttributeDescriptionsExcludingY2 || [],
        role = graphPlaceToAttrRole[place],
        attrID = dataConfiguration?.attributeID(role) || '';
      return place === 'left' && isScatterPlot
        ? yAttributeDescriptions.map((desc) => desc.attributeID)
        : [attrID];
    }, [dataConfiguration, graphModel.plotType, place]);

    const getLabel = useCallback(() => {
      // If we're using the CLUE legend, use a customizable label
      if (defaultSeriesLegend) {
        if (place === "left") {
          return graphModel.yAttributeLabel;
        } else {
          return graphModel.xAttributeLabel;
        }
      }
      if (useClickHereCue) {
        // empty axis shows the default axis label (if configured) or the click here prompt
        return defaultAxisLabels?.[place] || t('DG.AxisView.emptyGraphCue');
      }
      const attrIDs = getAttributeIDs();
      return attrIDs.map(anID => dataset?.attrFromID(anID)?.name)
        .filter(aName => aName !== '').join(', ');
    }, [dataset, defaultAxisLabels, defaultSeriesLegend, getAttributeIDs, graphModel, place, useClickHereCue]);

    const displayText = getLabel();
    const vertical = isVertical(place);
    const placeBounds = layout.getComputedBounds(place);
    const stringBounds = getStringBounds(displayText, defaultFont);
    const boxHeight = stringBounds.height + 2 * (kAxisLabelVerticalPadding + kAxisLabelBorderWidth) + 1;
    const boxWidth = stringBounds.width + 2 * (kAxisLabelHorizontalPadding + kAxisLabelBorderWidth) + 1;
    const height = vertical ? boxWidth : boxHeight;
    const width = vertical ? boxHeight : boxWidth;
    const foreignObjectWidth = vertical && editing ? inputWidth + 2 : width; // Accommodate text box when editing
    const x = place === "left" ? axisGap : placeBounds.left + (placeBounds.width - width) / 2;
    const y = place === "left" ? placeBounds.top + (placeBounds.height - height) / 2
      : placeBounds.top + placeBounds.height - height - axisGap;
    const foreignObjectStyle = { height, width: foreignObjectWidth, x, y };
    const divStyle = { height, width };

    const startEditing = readOnly || editing ? undefined
      : () => {
          if (!readOnly) {
            setEditing(true);
          }
        };

    const updateValue = (val: string) => {
      if (place === "left") {
        return graphModel.setYAttributeLabel(val);
      } else {
        return graphModel.setXAttributeLabel(val);
      }
    };

    const readyForPortal = positioningParentElt && onChangeAttribute && onTreatAttributeAs && onRemoveAttribute;
    const codapLegend = !defaultSeriesLegend;

    const divClassName = classNames("axis-label", place, { vertical, editing });
    return (
      <>
        <foreignObject {...foreignObjectStyle}>
          <div
            className={divClassName}
            onClick={startEditing}
            ref={(elt) => setLabelElt(elt)}
            style={divStyle}
          >
            {editing
              ? (
                <InputTextbox
                  defaultValue={displayText}
                  finishEditing={() => setEditing(false)}
                  inputRef={inputRef}
                  setWidth={setInputWidth}
                  updateValue={updateValue}
                />
              ) : (
                <div className={classNames({ vertical })} >
                  {displayText}
                </div>
              )
            }
          </div>
        </foreignObject>
        {readyForPortal && codapLegend &&
          <AxisOrLegendAttributeMenu
            target={labelElt}
            parent={positioningParentElt}
            portal={portalParentElt}
            place={place}
            onChangeAttribute={onChangeAttribute}
            onRemoveAttribute={onRemoveAttribute}
            onTreatAttributeAs={onTreatAttributeAs}
          />
        }
      </>
    );
  });
AttributeLabel.displayName = "AttributeLabel";
