import React, { useState } from "react";
import { observer } from "mobx-react";

import { NodeTypes } from "../../model/utilities/node";
import { DragEndEvent, DragOverlay, useDndMonitor, useDraggable, useDroppable } from "@dnd-kit/core";
import "./dataflow-program-toolbar.sass";
import { useUIStore } from "../../../../hooks/use-stores";

//added
import DragIconTemp from "../../assets/drag-icons/control-block-icon.svg";
import { DiagramHelper, Variable} from "@concord-consortium/diagram-view";
import { DataflowContentModelType } from "../../model/dataflow-content";
import { ITileModel } from "src/models/tiles/tile-model";
import { useNewVariableDialog } from "../../../shared-variables/dialog/use-new-variable-dialog";





interface IDFProgramToolBarProps {
  onNodeCreateClick: (type: string) => void;
  onClearClick: () => void;
  isTesting: boolean;
  disabled: boolean;
  droppableId: string;
  model: ITileModel;

}



/* ==[ Where you left off ] == */
// need to pass model inside observer and also props?

export const DataflowProgramToolbar: React.FC<IDFProgramToolBarProps> = observer((
  { onNodeCreateClick, onClearClick, model, isTesting, disabled, droppableId }: IDFProgramToolBarProps
) => {
  // console.log("<DataflowProgramToolbar> with props", props);
  // tileId in <NewVariableButton> is a hash specific to the overall tile
  // in diagram-toolbar.tsx (file that holds <NewVariableButton>), each button has a different component, and
  // only  <NewVariableButton> has a draggable on it.
  const content = model.content as DataflowContentModelType;



  const [diagramHelper, setDiagramHelper] = useState<DiagramHelper | undefined>();

  const ui = useUIStore();
  const draggableId = `new-node-draggable`;
  const { attributes, listeners, setNodeRef } = useDraggable({ id: draggableId });


  //line 46 of diagram-tile.tsx
  const insertVariables = (variablesToInsert: VariableType[], startX?: number, startY?: number) => {
    // Start at an arbitrary point...
    let x = 250;
    let y = 50;

    // ...unless we can find the center of the tile...
    const center = diagramHelper?.newCardPosition;
    if (center) {
      x = center.x;
      y = center.y;
    }

    // ...or the client specified a position.
    x = startX !== undefined ? startX : x;
    y = startY !== undefined ? startY : y;

    const offset = 25;
    variablesToInsert.forEach(variable => {
      content.root.insertNode(variable, {x, y});
      x += offset;
      y += offset;
      content.root.setSelectedNode(content.root.getNodeFromVariableId(variable.id));
    });
  };

  //line 70 of diagram-tile.tsx
  const [showNewVariableDialog] =
    useNewVariableDialog({ addVariable: insertVariable, sharedModel: content.sharedModel as SharedVariablesType });


  // const droppableId = `new-node-droppable`;
  // console.log("<DataFlowProgramToolBar> with droppableId", droppableId);

  const droppableInfo = useDroppable({ id: droppableId});
  const setDroppableNodeRef = droppableInfo.setNodeRef; //this is a function
  // console.log("dataflow: setDroppableNodeRef:", setDroppableNodeRef);

  // we have two useDndMonitors (other one in dataflow-program.tsx at end )
  useDndMonitor({
    onDragEnd: (event: DragEndEvent) => {
      console.log("1️⃣ <DataFlowProgramToolBar > onDragEnd with event:", event);
      if (event.over?.id) {
        console.log("1️⃣ <Dataflow  >  onDragEnd: with event.over?.id:", event.over?.id);
      }

      if (event.over?.id === droppableId && event.active.id === draggableId) {
        console.log("this is where we create the new dataflow node");
      //   // console.log("diagram-toolbar.tsx > onDragEnd > inside If");
      //   // console.log("check to see if its dropped on itself > click");
      //   // console.log("event:", event);
      //   // onNodeCreateClick();

      /* ==[ Where you left off ] == */
      //we need to create the nodes onto the canvas
        const pointerEvent = event.activatorEvent as PointerEvent;
        const clientX = pointerEvent.clientX + event.delta.x;
        const clientY = pointerEvent.clientY + event.delta.y;
        const position = diagramHelper?.convertClientToDiagramPosition({x: clientX, y: clientY});
        const { x, y } = position;

        const variable = Variable.create({});
        content.sharedModel?.addAndInsertVariable(
          variable,
          (v: VariableType) => insertVariable(variable, x, y)
        );

      }
    }
  });


  return (
    <div className="program-toolbar" data-test="program-toolbar">

      {
        NodeTypes.map((nt: any, i: any) => {
          return (
            <>
              <div key={`droppable-node-ref-${i}`} ref={setDroppableNodeRef}>
                <div ref={setNodeRef} {...attributes} {...listeners} >
                  <RenderAddNodeButton
                    key={`${nt.name}-${i}`}
                    onNodeCreateClick={onNodeCreateClick}
                    disabled={disabled}
                    nodeType={nt.name}
                    i={i}
                  />
                </div>
              </div>
              <DragOverlay>
                {
                  ui.dragId === draggableId.toString() ?
                  <DragIconTemp/> : null
                }
              </DragOverlay>
            </>


          );
        })
      }
      { isTesting && <button className={"qa"} onClick={onClearClick}>Clear</button> }
    </div>
  );
});



interface IAddNodeButtonProps {
  onNodeCreateClick: (type: string) => void;
  disabled: boolean;
  nodeType: string,
  i: number,
}


const RenderAddNodeButton: React.FC<IAddNodeButtonProps> = (props) => {
  const {onNodeCreateClick, disabled, nodeType, i} = props;
  // console.log("renderAddNodeButton with nodeType:", nodeType, "i: ", i);

  const handleAddNodeButtonClick = () => { onNodeCreateClick(nodeType); };
  const iconClass = "icon-block " + nodeType.toLowerCase().replace(" ", "-");
  const nodeIcons = [];
  switch (nodeType) {
    case "Number":
    case "Sensor":
    case "Generator":
    case "Timer":
      nodeIcons.push(<div className="icon-node right mid" key={"icon-node-r-m" + i}/>);
      break;
    case "Math":
    case "Logic":
    case "Control":
      nodeIcons.push(<div className="icon-node left top" key={"icon-node-l-t" + i}/>);
      nodeIcons.push(<div className="icon-node right mid" key={"icon-node-r-m" + i}/>);
      nodeIcons.push(<div className="icon-node left bottom" key={"icon-node-l-b" + i}/>);
      break;
    case "Transform":
      nodeIcons.push(<div className="icon-node left mid" key={"icon-node-l-m" + i}/>);
      nodeIcons.push(<div className="icon-node right mid" key={"icon-node-r-m" + i}/>);
      break;
    case "Demo Output":
    case "Live Output":
      nodeIcons.push(<div className="icon-node left mid" key={"icon-node-l-m" + i}/>);
      break;
  }
  const nodeIcon = (
    <div className={iconClass}>
      {nodeIcons}
    </div>
  );


  return (
      <button
        disabled={disabled}
        key={i} title={`Add ${nodeType} Block`}
        onClick={handleAddNodeButtonClick}
      >
        {nodeIcon}
        <div className="label">{nodeType}</div>
      </button>
  );
};

