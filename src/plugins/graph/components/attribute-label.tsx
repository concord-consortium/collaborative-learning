import classNames from "classnames";
import React, {useCallback, useEffect, useRef, useState} from "react";
// import {reaction} from "mobx";
import {observer} from "mobx-react-lite";
// import {select} from "d3";
import t from "../imports/utilities/translation/translate";
import {useDataConfigurationContext} from "../hooks/use-data-configuration-context";
import { defaultFont } from "../../../components/constants";
import { useReadOnlyContext } from "../../../components/document/read-only-context";
import {AttributeType} from "../../../models/data/attribute";
import {IDataSet} from "../../../models/data/data-set";
// import {isSetAttributeNameAction} from "../../../models/data/data-set-actions";
import {
  graphPlaceToAttrRole, kAxisLabelBorderWidth, kAxisLabelHorizontalPadding, kAxisLabelVerticalPadding,
  kGraphClassSelector, kGraphPortalClass
} from "../graph-types";
import { useGraphModelContext } from "../hooks/use-graph-model-context";
import { axisGap } from "../imports/components/axis/axis-types";
import { GraphPlace, isVertical } from "../imports/components/axis-graph-shared";
import { useGraphLayoutContext } from "../models/graph-layout";
// import {useTileModelContext} from "../../../components/tiles/hooks/use-tile-model-context";
import {getStringBounds} from "../imports/components/axis/axis-utils";
import {AxisOrLegendAttributeMenu} from "../imports/components/axis/components/axis-or-legend-attribute-menu";
import { useGraphSettingsContext } from "../hooks/use-graph-settings-context";

import "./attribute-label.scss";
import { InputTextbox } from "./input-textbox";
// import graphVars from "./graph.scss";

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
      // {isTileSelected} = useTileModelContext(),
      dataset = dataConfiguration?.dataset,
      useClickHereCue = dataConfiguration?.placeCanShowClickHereCue(place) ?? false,
      // hideClickHereCue = useClickHereCue &&
      //   !dataConfiguration?.placeAlwaysShowsClickHereCue(place) && !isTileSelected(),
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

    // const refreshAxisTitle = useCallback(() => {
    //   const labelFont = useClickHereCue ? graphVars.graphEmptyLabelFont : graphVars.graphLabelFont,
    //     bounds = layout.getComputedBounds(place),
    //     layoutIsVertical = isVertical(place),
    //     halfRange = layoutIsVertical ? bounds.height / 2 : bounds.width / 2,
    //     label = getLabel(),
    //     labelBounds = getStringBounds(label, labelFont),
    //     labelTransform = `translate(${bounds.left}, ${bounds.top})`,
    //     tX = place === 'left' ? labelBounds.height
    //       : place === 'legend' ? bounds.left
    //         : ['rightNumeric', 'rightCat'].includes(place) ? bounds.width - labelBounds.height / 2
    //           : halfRange,
    //     tY = isVertical(place) ? halfRange
    //       : place === 'legend' ? labelBounds.height / 2
    //         : place === 'top' ? labelBounds.height : bounds.height - labelBounds.height / 2,
    //     tRotation = isVertical(place) ? ` rotate(-90,${tX},${tY})` : '',
    //     className = useClickHereCue ? 'empty-label' : 'attribute-label';
    //   select(labelElt)
    //     .selectAll(`text.${className}`)
    //     .data([1])
    //     .join(
    //       enter => enter,
    //       (update) =>
    //         update
    //           .attr("transform", labelTransform + tRotation)
    //           .attr('class', className)
    //           .style('visibility', hideClickHereCue ? 'hidden' : 'visible')
    //           .attr('x', tX)
    //           .attr('y', tY)
    //           .text(label)
    //     );
    // }, [layout, place, labelElt, getLabel, useClickHereCue, hideClickHereCue]);

    // useEffect(function observeAttributeNameChange() {
    //   const disposer = dataConfiguration?.onAction(action => {
    //     if (isSetAttributeNameAction(action)) {
    //       const [changedAttributeID] = action.args;
    //       if (getAttributeIDs().includes(changedAttributeID)) {
    //         refreshAxisTitle();
    //       }
    //     }
    //   });

    //   return () => disposer?.();
    // }, [dataConfiguration, refreshAxisTitle, getAttributeIDs]);

    // Install reaction to bring about rerender when layout's computedBounds changes
    // useEffect(() => {
    //   const disposer = reaction(
    //     () => layout.getComputedBounds(place),
    //     () => refreshAxisTitle()
    //   );
    //   return () => disposer();
    // }, [place, layout, refreshAxisTitle]);

    // useEffect(function setupTitle() {

    //   const removeUnusedLabel = () => {
    //     const classNameToRemove = useClickHereCue ? 'attribute-label' : 'empty-label';
    //     select(labelElt)
    //       .selectAll(`text.${classNameToRemove}`)
    //       .remove();
    //   };

    //   if (labelElt) {
    //     removeUnusedLabel();
    //     const anchor = place === 'legend' ? 'start' : 'middle',
    //       className = useClickHereCue ? 'empty-label' : 'attribute-label';
    //     select(labelElt)
    //       .selectAll(`text.${className}`)
    //       .data([1])
    //       .join(
    //         (enter) =>
    //           enter.append('text')
    //             .attr('class', className)
    //             .attr('text-anchor', anchor)
    //             .attr('data-testid', `attribute-label-${place}`)
    //       );
    //     refreshAxisTitle();
    //   }
    // }, [labelElt, place, useClickHereCue, refreshAxisTitle]);

    // Respond to changes in attributeID assigned to my place
    // useEffect(() => {
    //   const disposer = reaction(
    //     () => {
    //       if (place === 'left') {
    //         return dataConfiguration?.yAttributeDescriptionsExcludingY2.map((desc) => desc.attributeID);
    //       }
    //       else {
    //         return dataConfiguration?.attributeID(graphPlaceToAttrRole[place]);
    //       }
    //     },
    //     () => {
    //       refreshAxisTitle();
    //     }
    //   );
    //   return () => disposer();
    // }, [place, dataConfiguration, refreshAxisTitle]);

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

    const divClassName = classNames("axis-label", { vertical, editing });
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
        {/* <g ref={(elt) => setLabelElt(elt)} className={`display-label ${place}`} /> */}
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
