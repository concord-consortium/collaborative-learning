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

/**
 * Builds an accessible label describing an axis-label trigger.
 *
 * @param place Axis position. `bottom`/`top` are X-axes, `left`/`rightNumeric` are Y-axes.
 * @param label The current display text (attribute name when one is assigned; empty/cue text otherwise).
 * @param readOnly When true, omits the affordance suffix because the trigger can't be activated.
 * @param hasAttribute When false, the trigger is in the "click to add..." cue state and Enter
 *   opens the attribute menu rather than starting an inline edit.
 */
export function buildAxisAriaLabel(
  place: GraphPlace, label: string, readOnly: boolean, hasAttribute: boolean
): string {
  const axisName = (place === "left" || place === "rightNumeric" || place === "yPlus") ? "Y-axis" : "X-axis";
  if (!hasAttribute) {
    return readOnly
      ? `${axisName}: no attribute selected`
      : `${axisName}: no attribute selected, press Enter to choose`;
  }
  return readOnly
    ? `${axisName} label: ${label}`
    : `${axisName} label: ${label}, press Enter to edit`;
}

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
      labelDivRef = useRef<HTMLDivElement | null>(null),
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
    const extraWidth = 2 * (kAxisLabelHorizontalPadding + kAxisLabelBorderWidth);
    const boxWidth = stringBounds.width + extraWidth + 1;
    const height = vertical ? boxWidth : boxHeight;
    const width = vertical ? boxHeight
      : editing ? inputWidth + extraWidth : boxWidth;
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

    // The "click to add..." cue is only visible in CODAP-legend mode. CLUE-legend tiles
    // always show a customizable label and treat Enter as "start editing", even when
    // no attribute is mapped.
    const cueIsShowing = useClickHereCue && codapLegend;
    const ariaLabel = buildAxisAriaLabel(place, displayText, readOnly, !cueIsShowing);

    /**
     * When the cue is showing, opening the attribute menu requires triggering Chakra's
     * MenuButton, which is portaled into the plot container. We tag that button with
     * `data-axis-menu-place={place}` (see AxisOrLegendAttributeMenu) and find it via DOM
     * query. Returns true if a button was found and clicked.
     */
    const openAttributeMenuForCue = () => {
      const menuBtn = positioningParentElt?.querySelector<HTMLButtonElement>(
        `[data-axis-menu-place="${place}"]`
      );
      if (menuBtn) {
        menuBtn.click();
        return true;
      }
      return false;
    };

    const handleLabelKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (readOnly) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        if (cueIsShowing) {
          openAttributeMenuForCue();
        } else {
          startEditing?.();
        }
      }
    };

    const setLabelRef = (elt: HTMLDivElement | null) => {
      labelDivRef.current = elt;
      setLabelElt(elt);
    };

    const divClassName = classNames("axis-label", place, { vertical, editing });
    return (
      <>
        <foreignObject {...foreignObjectStyle}>
          <div
            aria-label={ariaLabel}
            className={divClassName}
            onClick={startEditing}
            onKeyDown={handleLabelKeyDown}
            ref={setLabelRef}
            role="button"
            style={divStyle}
            tabIndex={0}
          >
            {editing
              ? (
                <InputTextbox
                  defaultValue={displayText}
                  finishEditing={() => setEditing(false)}
                  inputRef={inputRef}
                  setWidth={setInputWidth}
                  triggerRef={labelDivRef}
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
