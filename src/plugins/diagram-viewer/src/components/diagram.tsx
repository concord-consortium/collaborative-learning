import { observer } from "mobx-react-lite";
import { Instance } from "mobx-state-tree";
import { nanoid } from "nanoid";
import React, { useRef, useState } from "react";
import ReactFlow, { Edge, Elements, OnConnectFunc,
  OnEdgeUpdateFunc, MiniMap, Controls, ReactFlowProvider, FlowTransform } from "react-flow-renderer/nocss";
import { DQRootType } from "../models/dq-root";
import { DQNode } from "../models/dq-node";
import { NestedSet } from "./nested-set";
import { NodeForm } from "./node-form";
import { QuantityNode } from "./quantity-node";
import { ToolBar } from "./toolbar";

// We use the nocss version of RF so we can manually load
// the CSS. This way we can override it.
// Otherwise RF injects its CSS after our CSS, so we can't
// override it.
import "react-flow-renderer/dist/style.css";
import "react-flow-renderer/dist/theme-default.css";

// The order matters the diagram css overrides some styles
// from the react-flow css.
import "./diagram.scss";

const url = new URL(window.location.href);
const showNestedSet = !(url.searchParams.get("nestedSet") == null);

const uniqueId = () => nanoid(16);

const nodeTypes = {
  quantityNode: QuantityNode,
};

interface IProps {
  dqRoot: DQRootType;
  initialFlowTransform?: FlowTransform;
  onChangeFlowTransform?: (transform?: FlowTransform) => void;
}
export const _Diagram = ({ dqRoot, initialFlowTransform, onChangeFlowTransform }: IProps) => {
  const reactFlowWrapper = useRef<any>(null);
  const [selectedNode, setSelectedNode] = useState<Instance<typeof DQNode> | undefined>();
  const [rfInstance, setRfInstance] = useState<any>();

  // gets called after end of edge gets dragged to another source or target
  const onEdgeUpdate: OnEdgeUpdateFunc = (oldEdge, newConnection) => {

    // We could try to be smart about this, and only update things that
    // changed but it is easier to just break the old connection
    // and make a new one
    const oldTargetNode = dqRoot.nodes.get(oldEdge.target);
    const oldTargetHandle = oldEdge.targetHandle;
    if (oldTargetHandle === "a") {
      oldTargetNode?.setInputA(undefined);
    } else if (oldTargetHandle === "b") {
      oldTargetNode?.setInputB(undefined);
    }

    const { source, target, targetHandle: newTargetHandle } = newConnection;
    const newSourceNode = source ? dqRoot.nodes.get(source) : undefined;
    const newTargetNode = target ? dqRoot.nodes.get(target) : undefined;
    if (newTargetHandle === "a") {
      newTargetNode?.setInputA(newSourceNode);
    } else if (newTargetHandle === "b") {
      newTargetNode?.setInputB(newSourceNode);
    }
  };

  const onConnect: OnConnectFunc = (params) => {
    const { source, target, targetHandle } = params;
    console.log(`connection source: ${source} to target: ${target} on handle: ${targetHandle}`);
    if ( source && target ) {
      const targetModel = dqRoot.nodes.get(target);
      const sourceModel = dqRoot.nodes.get(source);
      if (targetHandle === "a") {
        targetModel?.setInputA(sourceModel);
      } else if (targetHandle === "b") {
        targetModel?.setInputB(sourceModel);
      }
    }
  };

  const onElementsRemove = (elementsToRemove: Elements) => {
    for(const element of elementsToRemove) {
      console.log(element);
      if ((element as any).target) {
        // This is a edge (I think)
        const edge = element as Edge;
        const { target, targetHandle } = edge;
        const targetModel = dqRoot.nodes.get(target);
        if (targetHandle === "a") {
          targetModel?.setInputA(undefined);
        } else if (targetHandle === "b") {
          targetModel?.setInputB(undefined);
        }
      } else {
        // If this is the selected node we need to remove it from the state too
        const nodeToRemove = dqRoot.nodes.get(element.id);
        setSelectedNode((currentNode) => nodeToRemove === currentNode ? undefined : currentNode);
        dqRoot.removeNodeById(element.id);
      }
    }
  };

  const onSelectionChange = (selectedElements: Elements | null) => {
    if (selectedElements?.[0]?.type === "quantityNode" ) {
      setSelectedNode(dqRoot.nodes.get(selectedElements[0].id));
    } else {
      setSelectedNode(undefined);
    }
  };

  const onDragOver = (event: any) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  const onDrop = (event: any) => {
    event.preventDefault();

    if (!reactFlowWrapper.current || !rfInstance) {
      return;
    }

    const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
    const position = rfInstance.project({
      x: event.clientX - reactFlowBounds.left,
      y: event.clientY - reactFlowBounds.top,
    });

    const dqNode = DQNode.create({
      id: uniqueId(),
      x: position.x,
      y: position.y
    });
    dqRoot.addNode(dqNode);
  };

  const onNodeDrag = (event: React.MouseEvent<Element, MouseEvent>, node: any) => {
    event.stopPropagation();
  };

  // Keep the MST node model in sync with the diagram
  const onNodeDragStop = (event: any, node: any) => {
    const mstNode = dqRoot.nodes.get(node.id);
    mstNode?.updatePosition(node.position.x, node.position.y);
    event.stopPropagation();
  };

  const { zoom: defaultZoom, x, y } = initialFlowTransform || {};
  const defaultPosition: [number, number] | undefined = x != null && y != null ? [x, y] : undefined;

  return (
    <div className="diagram" ref={reactFlowWrapper}>
      <ReactFlowProvider>
        <ReactFlow elements={dqRoot.reactFlowElements}
          defaultPosition={defaultPosition}
          defaultZoom={defaultZoom}
          nodeTypes={nodeTypes}
          onEdgeUpdate={onEdgeUpdate}
          onConnect={onConnect as any}  // TODO: fix types
          onElementsRemove={onElementsRemove}
          onSelectionChange={onSelectionChange}
          onLoad={(_rfInstance) => setRfInstance(_rfInstance)}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          onMoveEnd={onChangeFlowTransform}>
          <MiniMap/>
          <Controls />
          { selectedNode &&
            <>
              <NodeForm node={selectedNode}/>
              { showNestedSet &&
                <div style={{zIndex: 4, position: "absolute", left: "300px"}}>
                  <NestedSet node={selectedNode} final={true} />
                </div>
              }
            </>
          }
          <ToolBar dqRoot={dqRoot}/>
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
};

export const Diagram = observer(_Diagram);
Diagram.displayName = "Diagram";
