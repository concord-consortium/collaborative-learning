import React, {MutableRefObject, useCallback, useEffect} from "react";
import {observer} from "mobx-react-lite";
import {isAlive} from "mobx-state-tree";
import {Active} from "@dnd-kit/core";
import {useInstanceIdContext} from "../hooks/use-instance-id-context";
import {AttributeType} from "../../../models/data/attribute";
import {useGraphModelContext} from "../models/graph-model";
import {useDataConfigurationContext} from "../hooks/use-data-configuration-context";
import {useGraphLayoutContext} from "../models/graph-layout";
import {getDragAttributeId, useDropHandler} from "../hooks/use-drag-drop";
import {AxisPlace} from "../axis/axis-types";
import {Axis} from "../axis/components/axis";
import {axisPlaceToAttrRole, kGraphClassSelector} from "../graph-types";
import {GraphPlace} from "../axis-graph-shared";
import {DroppableAxis} from "../axis/components/droppable-axis";
import {AttributeLabel} from "./attribute-label";
import {useDropHintString} from "../hooks/use-drop-hint-string";
import {useAxisBoundsProvider} from "../axis/hooks/use-axis-bounds";
import { isAddCasesAction, isSetCaseValuesAction } from "../../../models/data/data-set-actions";
import { computeNiceNumericBounds } from "../utilities/graph-utils";
import { IAxisModel, isNumericAxisModel } from "../axis/models/axis-model";
import { useSettingFromStores } from "../../../hooks/use-stores";

interface IProps {
  place: AxisPlace
  enableAnimation: MutableRefObject<boolean>
  autoAdjust?: React.MutableRefObject<boolean>
  onDropAttribute?: (place: GraphPlace, attrId: string) => void
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
    emptyPlotIsNumeric = useSettingFromStores("emptyPlotIsNumeric", "graph") as boolean | undefined,
    axisShouldShowGridlines = emptyPlotIsNumeric || graphModel.axisShouldShowGridLines(place);

  const handleIsActive = (active: Active) => {
    const droppedAttrId = getDragAttributeId(active) ?? '';
    if (isDropAllowed) {
      return isDropAllowed(place, droppedAttrId);
    } else {
      return !!droppedAttrId;
    }
  };

  const {parentElt, wrapperElt,
    setWrapperElt} = useAxisBoundsProvider(place, kGraphClassSelector);

  useDropHandler(droppableId, active => {
    const droppedAttrId = getDragAttributeId(active);
    droppedAttrId && isDropAllowed(place, droppedAttrId) && onDropAttribute?.(place, droppedAttrId);
  });

  useEffect(() => {
    if (autoAdjust?.current) {
      dataConfig?.onAction(action => {
        if (
            isAlive(graphModel) &&
            (isAddCasesAction(action) || isSetCaseValuesAction(action))
           )
        {
          const xValues = dataConfig.numericValuesForAttrRole("x");
          const yValues = dataConfig.numericValuesForAttrRole("y");
          const axisModel = graphModel.getAxis(place);

          if (axisModel && isNumericAxisModel(axisModel)) {
            if (xValues && place === "bottom") {
              const minX = Math.min(...xValues);
              const maxX = Math.max(...xValues);
              const newXBounds = computeNiceNumericBounds(minX, maxX);
              axisModel.setDomain(newXBounds.min, newXBounds.max);
            }

            if (yValues && place === "left") {
              const minY = Math.min(...yValues);
              const maxY = Math.max(...yValues);
              const newYBounds = computeNiceNumericBounds(minY, maxY);
              axisModel.setDomain(newYBounds.min, newYBounds.max);
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

  const getAxisModel = useCallback((): IAxisModel | undefined => {
    if (isAlive(graphModel)) return graphModel.getAxis(place);
    console.warn("GraphAxis.getAxisModel", "attempt to access defunct graph model");
  }, [graphModel, place]);

  return (
    <g className='axis-wrapper' ref={elt => setWrapperElt(elt)}>
      <Axis getAxisModel={getAxisModel}
            label={''}  // Remove
            enableAnimation={enableAnimation}
            showScatterPlotGridLines={axisShouldShowGridlines}
            centerCategoryLabels={graphModel.config.categoriesForAxisShouldBeCentered(place)}
      />
      <AttributeLabel
        place={place}
        onChangeAttribute={onDropAttribute}
        onRemoveAttribute={onRemoveAttribute}
        onTreatAttributeAs={onTreatAttributeAs}
      />
      {onDropAttribute &&
         <DroppableAxis
            place={`${place}`}
            dropId={droppableId}
            hintString={hintString}
            portal={parentElt}
            target={wrapperElt}
            onIsActive={handleIsActive}
         />}
    </g>
  );
});
