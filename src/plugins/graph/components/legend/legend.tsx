import {autorun} from "mobx";
import React, {useEffect, useRef} from "react";
import {select} from "d3";
import {Active} from "@dnd-kit/core";
import {useDataConfigurationContext} from "../../hooks/use-data-configuration-context";
import {useGraphLayoutContext} from "../../models/graph-layout";
import {AttributeLabel} from "../attribute-label";
import {CategoricalLegend} from "./categorical-legend";
import {NumericLegend} from "./numeric-legend";
import {DroppableSvg} from "../droppable-svg";
import {useInstanceIdContext} from "../../imports/hooks/use-instance-id-context";
import {getDragAttributeInfo, useDropHandler} from "../../imports/hooks/use-drag-drop";
import {useDropHintString} from "../../imports/hooks/use-drop-hint-string";
import {AttributeType} from "../../../../models/data/attribute";
import {IDataSet} from "../../../../models/data/data-set";
import {GraphAttrRole} from "../../graph-types";
import {GraphPlace} from "../../imports/components/axis-graph-shared";
import { useGraphSettingsContext } from "../../hooks/use-graph-settings-context";

interface ILegendProps {
  legendAttrID: string
  graphElt: HTMLDivElement | null
  onDropAttribute: (place: GraphPlace, dataSet: IDataSet, attrId: string) => void
  onRemoveAttribute: (place: GraphPlace, attrId: string) => void
  onTreatAttributeAs: (place: GraphPlace, attrId: string, treatAs: AttributeType) => void
}

export const Legend = function Legend({
                                        legendAttrID, graphElt,
                                        onDropAttribute, onTreatAttributeAs, onRemoveAttribute
                                      }: ILegendProps) {
  const dataConfiguration = useDataConfigurationContext(),
    isDropAllowed = dataConfiguration?.graphPlaceCanAcceptAttributeIDDrop ?? (() => true),
    layout = useGraphLayoutContext(),
    attrType = dataConfiguration?.dataset?.attrFromID(legendAttrID ?? '')?.type,
    legendRef = useRef() as React.RefObject<SVGSVGElement>,
    instanceId = useInstanceIdContext(),
    droppableId = `${instanceId}-legend-area-drop`,
    role = 'legend' as GraphAttrRole,
    hintString = useDropHintString({role}),
    { disableAttributeDnD } = useGraphSettingsContext();

  const handleIsActive = (active: Active) => {
    const {dataSet, attributeId: droppedAttrId} = getDragAttributeInfo(active) || {};
    if (isDropAllowed) {
      return isDropAllowed('legend', dataSet, droppedAttrId);
    } else {
      return !!droppedAttrId;
    }
  };

  useDropHandler(droppableId, active => {
    const {dataSet, attributeId: dragAttributeID} = getDragAttributeInfo(active) || {};
    dataSet && dragAttributeID && isDropAllowed('legend', dataSet, dragAttributeID) &&
    onDropAttribute('legend', dataSet, dragAttributeID);
  });

  const legendBounds = layout.computedBounds.legend,
    transform = `translate(${legendBounds.left}, ${legendBounds.top})`;

  /**
   * Because the interior of the graph (the plot) can be transparent, we have to put a background behind
   * axes and legends.
   */
  useEffect(function installBackground() {
    return autorun(() => {
      if (legendRef) {
        select(legendRef.current)
          .selectAll<SVGRectElement, number>('.legend-background')
          .attr('transform', `translate(0, ${legendBounds.top})`)
          .attr('width', layout.graphWidth)
          .attr('height', legendBounds.height);
      }
    });
  }, [layout.graphWidth, legendBounds, legendRef, transform]);

  return legendAttrID ? (
    <>
      <svg ref={legendRef} className='legend-component'>
        <rect className='legend-background'/>
        <AttributeLabel
          place={'legend'}
          onChangeAttribute={onDropAttribute}
          onRemoveAttribute={onRemoveAttribute}
          onTreatAttributeAs={onTreatAttributeAs}
        />
        {
          attrType === 'categorical' ? <CategoricalLegend transform={transform}/>
            : attrType === 'numeric' ? <NumericLegend legendAttrID={legendAttrID}/> : null
        }
      </svg>
      { !disableAttributeDnD &&
        <DroppableSvg
          className="droppable-legend"
          portal={graphElt}
          target={legendRef.current}
          dropId={droppableId}
          onIsActive={handleIsActive}
          hintString={hintString}
        />
      }
    </>

  ) : null;
};
Legend.displayName = "Legend";
