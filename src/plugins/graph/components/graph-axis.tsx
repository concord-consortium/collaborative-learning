import React, {MutableRefObject, useCallback, useEffect, useRef, useState} from "react";
import {autorun} from "mobx";
import {observer} from "mobx-react-lite";
import {isAlive} from "mobx-state-tree";
import {select} from "d3";
import {Active} from "@dnd-kit/core";
import {useInstanceIdContext} from "../imports/hooks/use-instance-id-context";
import {AttributeType} from "../../../models/data/attribute";
import { IDataSet } from "../../../models/data/data-set";
import {useGraphModelContext} from "../models/graph-model";
import {useDataConfigurationContext} from "../hooks/use-data-configuration-context";
import {useGraphLayoutContext} from "../models/graph-layout";
import {getDragAttributeInfo, useDropHandler} from "../imports/hooks/use-drag-drop";
import {AxisPlace} from "../imports/components/axis/axis-types";
import {Axis} from "../imports/components/axis/components/axis";
import {axisPlaceToAttrRole, kGraphClassSelector} from "../graph-types";
import {GraphPlace} from "../imports/components/axis-graph-shared";
import {AttributeLabel} from "./attribute-label";
import {useDropHintString} from "../imports/hooks/use-drop-hint-string";
import { isAddCasesAction, isSetCaseValuesAction } from "../../../models/data/data-set-actions";
import { computeNiceNumericBounds } from "../utilities/graph-utils";
import { isNumericAxisModel } from "../imports/components/axis/models/axis-model";
import { DroppableAxis } from "./droppable-axis";
import { useGraphSettingsContext } from "../hooks/use-graph-settings-context";

interface IProps {
  place: AxisPlace
  enableAnimation: MutableRefObject<boolean>
  autoAdjust?: React.MutableRefObject<boolean>
  onDropAttribute?: (place: GraphPlace, dataSet: IDataSet, attrId: string) => void
  onRemoveAttribute?: (place: GraphPlace, attrId: string) => void
  onTreatAttributeAs?: (place: GraphPlace, attrId: string, treatAs: AttributeType) => void
}

export const GraphAxis = observer(function GraphAxis({
  place, enableAnimation, autoAdjust, onDropAttribute, onRemoveAttribute, onTreatAttributeAs
}: IProps) {
  const dataConfig = useDataConfigurationContext(),
    isDropAllowed = dataConfig?.graphPlaceCanAcceptAttributeIDDrop ?? (() => true),
    graphModel = useGraphModelContext(),
    instanceId = useInstanceIdContext(),
    layout = useGraphLayoutContext(),
    droppableId = `${instanceId}-${place}-axis-drop`,
    hintString = useDropHintString({role: axisPlaceToAttrRole[place]}),
    { disableAttributeDnD, emptyPlotIsNumeric, defaultSeriesLegend } = useGraphSettingsContext(),
    axisShouldShowGridlines = emptyPlotIsNumeric || graphModel.axisShouldShowGridLines(place),
    parentEltRef = useRef<HTMLDivElement | null>(null),
    [wrapperElt, _setWrapperElt] = useState<SVGGElement | null>(null),
    setWrapperElt = useCallback((elt: SVGGElement | null) => {
      parentEltRef.current = elt?.closest(kGraphClassSelector) as HTMLDivElement ?? null;
      _setWrapperElt(elt);
    }, []);
  const handleIsActive = (active: Active) => {
    const {dataSet, attributeId: droppedAttrId} = getDragAttributeInfo(active) || {};
    if (isDropAllowed) {
      return isDropAllowed(place, dataSet, droppedAttrId);
    } else {
      return !!droppedAttrId;
    }
  };
  useDropHandler(droppableId, active => {
    const {dataSet, attributeId: droppedAttrId} = getDragAttributeInfo(active) || {};
    dataSet && droppedAttrId && isDropAllowed(place, dataSet, droppedAttrId) &&
    onDropAttribute?.(place, dataSet, droppedAttrId);
  });

  /**
   * Because the interior of the graph (the plot) can be transparent, we have to put a background behind
   * axes and legends. Furthermore, there are some rectangles that aren't even part of these that we have
   * to special case.
   */
  useEffect(function installBackground() {
    return autorun(() => {
      if (wrapperElt) {
        const bounds = layout.getComputedBounds(place),
          graphWidth = layout.graphWidth,
          left = ['bottom', 'top'].includes(place) ? 0 : bounds.left,
          width = ['bottom', 'top'].includes(place) ? graphWidth : bounds.width,
          transform = `translate(${left}, ${bounds.top})`;
        select(wrapperElt)
          .selectAll<SVGRectElement, number>('rect.axis-background')
          .attr('transform', transform)
          .attr('width', width)
          .attr('height', bounds.height);
      }
    });
  }, [layout, place, wrapperElt]);

  useEffect(() => {
    if (autoAdjust?.current) {
      // TODO multi dataset - this should consider all layers
      dataConfig?.onAction(action => {
        if (
            isAlive(graphModel) &&
            (isAddCasesAction(action) || isSetCaseValuesAction(action))
           )
        {
          const _axisModel = graphModel?.getAxis(place);
          const xValues = dataConfig.numericValuesForAttrRole("x");
          const yValues = dataConfig.numericValuesForAttrRole("y");

          if (_axisModel && isNumericAxisModel(_axisModel)) {
            if (xValues.length > 0 && place === "bottom") {
              const minX = Math.min(...xValues);
              const maxX = Math.max(...xValues);
              const newXBounds = computeNiceNumericBounds(minX, maxX);
              _axisModel.setDomain(newXBounds.min, newXBounds.max);
            }

            if (yValues.length > 0 && place === "left") {
              const minY = Math.min(...yValues);
              const maxY = Math.max(...yValues);
              const newYBounds = computeNiceNumericBounds(minY, maxY);
              _axisModel.setDomain(newYBounds.min, newYBounds.max);
            }
          }
        }
      });
    }
  }, [autoAdjust, dataConfig, graphModel, layout, place]);

  useEffect(function cleanup () {
    return () => {
      // This gets called when the component is unmounted, which happens when the graph is closed.
      // In that case setting the desired extent in the layout will cause MST model errors.
      if (isAlive(graphModel)) {
        layout.setDesiredExtent(place, 0);
      }
    };
  }, [layout, place, graphModel]);

  const axisModel = graphModel?.getAxis(place);
  const showAttributeLabel = place === "left" || !defaultSeriesLegend;

  return (
    <g className='axis-wrapper' ref={elt => setWrapperElt(elt)}>
      <rect className='axis-background'/>
      {axisModel && isAlive(axisModel) &&
        <Axis
          axisModel={axisModel}
          label={''}  // Remove
          enableAnimation={enableAnimation}
          showScatterPlotGridLines={axisShouldShowGridlines}
          centerCategoryLabels={graphModel.categoriesForAxisShouldBeCentered(place)}
        />
      }
      {showAttributeLabel &&
        <AttributeLabel
          layer={graphModel.layers[0]} // This is a non-multiple-dataset/multi-legend case
          place={place}
          onChangeAttribute={onDropAttribute}
          onRemoveAttribute={onRemoveAttribute}
          onTreatAttributeAs={onTreatAttributeAs}
        />
      }
      {onDropAttribute && !disableAttributeDnD &&
        <DroppableAxis
          place={`${place}`}
          dropId={droppableId}
          hintString={hintString}
          portal={parentEltRef.current}
          target={wrapperElt}
          onIsActive={handleIsActive}
        />
      }
    </g>
  );
});
