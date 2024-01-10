import React, {useCallback, /*useEffect,*/ useState} from "react";
// import {reaction} from "mobx";
import {observer} from "mobx-react-lite";
// import {select} from "d3";
import t from "../imports/utilities/translation/translate";
import {useDataConfigurationContext} from "../hooks/use-data-configuration-context";
import {AttributeType} from "../../../models/data/attribute";
import {IDataSet} from "../../../models/data/data-set";
// import {isSetAttributeNameAction} from "../../../models/data/data-set-actions";
import { GraphPlace, isVertical } from "../imports/components/axis-graph-shared";
import {graphPlaceToAttrRole, kGraphClassSelector, kGraphPortalClass} from "../graph-types";
import { useGraphModelContext } from "../hooks/use-graph-model-context";
import { useGraphLayoutContext } from "../models/graph-layout";
// import {useTileModelContext} from "../../../components/tiles/hooks/use-tile-model-context";
import {getStringBounds} from "../imports/components/axis/axis-utils";
import {AxisOrLegendAttributeMenu} from "../imports/components/axis/components/axis-or-legend-attribute-menu";
import { useGraphSettingsContext } from "../hooks/use-graph-settings-context";

import "./attribute-label.scss";
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
      // {isTileSelected} = useTileModelContext(),
      dataset = dataConfiguration?.dataset,
      useClickHereCue = dataConfiguration?.placeCanShowClickHereCue(place) ?? false,
      // hideClickHereCue = useClickHereCue &&
      //   !dataConfiguration?.placeAlwaysShowsClickHereCue(place) && !isTileSelected(),
      [labelElt, setLabelElt] = useState<HTMLDivElement | null>(null),
      portalParentElt = labelElt?.closest(kGraphPortalClass) as HTMLDivElement ?? null,
      positioningParentElt = labelElt?.closest(kGraphClassSelector) as HTMLDivElement ?? null;

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
      if (useClickHereCue) {
        // empty axis shows the default axis label (if configured) or the click here prompt
        return defaultAxisLabels?.[place] || t('DG.AxisView.emptyGraphCue');
      }
      const attrIDs = getAttributeIDs();
      return attrIDs.map(anID => dataset?.attrFromID(anID)?.name)
        .filter(aName => aName !== '').join(', ');
    }, [dataset, defaultAxisLabels, getAttributeIDs, place, useClickHereCue]);

    const horizontalPadding = 10;
    const verticalPadding = 5;
    const displayText = getLabel();
    const vertical = isVertical(place);
    const placeBounds = layout.getComputedBounds(place);
    const stringBounds = getStringBounds(displayText);
    const boxHeight = stringBounds.height + 2 * verticalPadding;
    const boxWidth = stringBounds.width + 2 * horizontalPadding;
    const height = vertical ? boxWidth : boxHeight;
    const width = vertical ? boxHeight : boxWidth;
    const x = placeBounds.left + (placeBounds.width - width) / 2;
    const y = placeBounds.top + (placeBounds.height - height) / 2;
    const foreignObjectStyle = { height, width, x, y };

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

    const readyForPortal = positioningParentElt && onChangeAttribute && onTreatAttributeAs && onRemoveAttribute;
    const skipPortal = defaultSeriesLegend && place === "left";

    return (
      <>
        <foreignObject {...foreignObjectStyle}>
          <div className="axis-label" ref={(elt) => setLabelElt(elt)} >
            {displayText}
          </div>
        </foreignObject>
        {/* <g ref={(elt) => setLabelElt(elt)} className={`display-label ${place}`} /> */}
        {readyForPortal && !skipPortal &&
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
