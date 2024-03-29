import React, {MutableRefObject, useCallback, useEffect, useRef, useState} from "react";
import {autorun} from "mobx";
import {observer} from "mobx-react-lite";
import {isAlive} from "mobx-state-tree";
import {select} from "d3";
import {Active} from "@dnd-kit/core";
import {useInstanceIdContext} from "../imports/hooks/use-instance-id-context";
import {AttributeType} from "../../../models/data/attribute";
import { IDataSet } from "../../../models/data/data-set";
import { useGraphModelContext } from "../hooks/use-graph-model-context";
import {useDataConfigurationContext} from "../hooks/use-data-configuration-context";
import {useGraphLayoutContext} from "../models/graph-layout";
import {getDragAttributeInfo, useDropHandler} from "../imports/hooks/use-drag-drop";
import {AxisPlace} from "../imports/components/axis/axis-types";
import {Axis} from "../imports/components/axis/components/axis";
import {axisPlaceToAttrRole, kGraphClassSelector} from "../graph-types";
import {GraphPlace} from "../imports/components/axis-graph-shared";
import {AttributeLabel} from "./attribute-label";
import {useDropHintString} from "../imports/hooks/use-drop-hint-string";
import { DroppableAxis } from "./droppable-axis";
import { useGraphSettingsContext } from "../hooks/use-graph-settings-context";
import { GraphController } from "../models/graph-controller";

interface IProps {
  place: AxisPlace;
  enableAnimation: MutableRefObject<boolean>;
  controller: GraphController;
  onDropAttribute?: (place: GraphPlace, dataSet: IDataSet, attrId: string) => void;
  onRemoveAttribute?: (place: GraphPlace, attrId: string) => void;
  onTreatAttributeAs?: (place: GraphPlace, attrId: string, treatAs: AttributeType) => void;
}

export const GraphAxis = observer(function GraphAxis({
  place, enableAnimation, controller, onDropAttribute, onRemoveAttribute, onTreatAttributeAs
}: IProps) {
  const dataConfig = useDataConfigurationContext(), // FIXME mult-dataset.
    isDropAllowed = dataConfig?.graphPlaceCanAcceptAttributeIDDrop ?? (() => true),
    graphModel = useGraphModelContext(),
    instanceId = useInstanceIdContext(),
    layout = useGraphLayoutContext(),
    droppableId = `${instanceId}-${place}-axis-drop`,
    hintString = useDropHintString({role: axisPlaceToAttrRole[place]}),
    { disableAttributeDnD, emptyPlotIsNumeric } = useGraphSettingsContext(),
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
        const bounds = layout.getComputedBounds(place);
        const graphWidth = layout.graphWidth;
        const left = ['bottom', 'top'].includes(place) ? 0 : bounds.left;
        const width = ['bottom', 'top'].includes(place) ? graphWidth : bounds.width;
        const transform = `translate(${left}, ${bounds.top})`;

        select(wrapperElt)
          .selectAll<SVGRectElement, number>('rect.axis-background')
          .attr('transform', transform)
          .attr('width', width)
          .attr('height', bounds.height);
      }
    });
  }, [layout, place, wrapperElt]);

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
      <AttributeLabel
        place={place}
        onChangeAttribute={onDropAttribute}
        onRemoveAttribute={onRemoveAttribute}
        onTreatAttributeAs={onTreatAttributeAs}
      />
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
