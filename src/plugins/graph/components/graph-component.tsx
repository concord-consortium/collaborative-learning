import {useDndContext, useDroppable} from '@dnd-kit/core';
import {observer} from "mobx-react-lite";
import React, {useEffect, useMemo, useRef} from "react";
import {useResizeDetector} from "react-resize-detector";
import {ITileBaseProps} from '../imports/components/tiles/tile-base-props';
import {useGraphController} from "../hooks/use-graph-controller";
import {InstanceIdContext, useNextInstanceId} from "../imports/hooks/use-instance-id-context";
import {AxisLayoutContext} from "../imports/components/axis/models/axis-layout-context";
import {GraphController} from "../models/graph-controller";
import {GraphLayout, GraphLayoutContext} from "../models/graph-layout";
import {GraphModelContext, isGraphModel} from "../models/graph-model";
import {Graph} from "./graph";
import {AttributeDragOverlay} from "../imports/components/drag-drop/attribute-drag-overlay";
import "../register-adornment-types";

interface IGraphComponentProps extends ITileBaseProps {
  layout: GraphLayout;
  onRequestRowHeight?: (id: string, size: number) => void;
  readOnly?: boolean;
}
export const GraphComponent = observer(
    function GraphComponent({ layout, tile, onRequestRowHeight, readOnly }: IGraphComponentProps) {
  const graphModel = isGraphModel(tile?.content) ? tile?.content : undefined;
  const instanceId = useNextInstanceId("graph");
  // Removed debouncing, but we can bring it back if we find we need it
  const graphRef = useRef<HTMLDivElement | null>(null);
  const {width, height} = useResizeDetector<HTMLDivElement>({ targetRef: graphRef });
  const enableAnimation = useRef(true);
  const autoAdjustAxes = useRef(true);
  const graphController = useMemo(
    () => new GraphController({layout, enableAnimation, instanceId, autoAdjustAxes}),
    [layout, instanceId]
  );

  useGraphController({graphController, graphModel});

  useEffect(() => {
    (width != null) && (height != null) && layout.setParentExtent(width, height);
  }, [width, height, layout]);

  // used to determine when a dragged attribute is over the graph component
  const dropId = `${instanceId}-component-drop-overlay`;
  const {setNodeRef} = useDroppable({id: dropId});
  setNodeRef(graphRef.current ?? null);

  const { active } = useDndContext();
  const overlayDragId = active && `${active.id}`.startsWith(instanceId)
    ? `${active.id}` : undefined;

  if (!graphModel) return null;

  return (
    <InstanceIdContext.Provider value={instanceId}>
      <GraphLayoutContext.Provider value={layout}>
        <AxisLayoutContext.Provider value={layout}>
          <GraphModelContext.Provider value={graphModel}>
            <Graph graphController={graphController}
              graphRef={graphRef}
              onRequestRowHeight={onRequestRowHeight}
              readOnly={readOnly}
            />
            <AttributeDragOverlay activeDragId={overlayDragId} />
          </GraphModelContext.Provider>
        </AxisLayoutContext.Provider>
      </GraphLayoutContext.Provider>
    </InstanceIdContext.Provider>
  );
});
