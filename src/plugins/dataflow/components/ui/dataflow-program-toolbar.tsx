import React from "react";
import { NodeTypes } from "../../model/utilities/node";
import { DragEndEvent, DragOverlay, useDndMonitor, useDraggable, useDroppable } from "@dnd-kit/core";
import "./dataflow-program-toolbar.sass";
import { useUIStore } from "../../../../hooks/use-stores";
// import { useUIStore } from "../../hooks/use-stores";



interface IDFProgramToolBarProps {
  onNodeCreateClick: (type: string) => void;
  onClearClick: () => void;
  isTesting: boolean;
  disabled: boolean;
  droppableId: string;
}


export const DataflowProgramToolbar: React.FC<IDFProgramToolBarProps> = (props) => {
  const { onNodeCreateClick, onClearClick, isTesting, disabled, droppableId } = props;
  // console.log("<DataflowProgramToolbar> with props", props);

  //tileId in <NewVariableButton> is a unique hash for each diagram tool dragged into canvas
  // in diagram-toolbar.tsx (file that holds <NewVariableButton>), each button has a different component, and
  //only  <NewVariableButton> has a draggable on it.

  const ui = useUIStore();
  const draggableId = `new-node-draggable`;
  const { attributes, listeners, setNodeRef } = useDraggable({ id:draggableId });
  // const droppableId = `new-node-droppable`;
    console.log("<DataFlowProgramToolBar> with droppableId", droppableId);

  const droppableInfo = useDroppable({ id: droppableId});
  const setDroppableNodeRef = droppableInfo.setNodeRef;

  useDndMonitor({
    onDragEnd: (event: DragEndEvent) => {
      console.log("<DataFlowProgramToolBar > onDragEnd");
    }
  });


  return (
    <div className="program-toolbar" data-test="program-toolbar">
      <div ref={setDroppableNodeRef}>
        {/* <div ref={setNodeRef} {...attributes} {...listeners}> */}
        {
            NodeTypes.map((nt: any, i: any) => {
              // above line 47 ref={setNodeRef} causes error where u cant even click on sensor or number

              // const draggableIdLocal = `new-node-draggable-${i}`;
              // const { attributes, listeners, setNodeRef } = useDraggable({id:draggableIdLocal});
              //  ^^^^ cant be used inside of a call back ^^^
              return (
                <RenderAddNodeButton
                  key={`${nt.name}-${i}`}
                  onNodeCreateClick={onNodeCreateClick}
                  disabled={disabled}
                  nodeType={nt.name}
                  i={i}
                />
              );
            })
          }
          { isTesting && <button className={"qa"} onClick={onClearClick}>Clear</button> }
        {/* </div> */}
      </div>
    </div>
  );
};



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
    // <div ref={setDroppableNodeRef}>
      <button
        disabled={disabled}
        key={i} title={`Add ${nodeType} Block`}
        onClick={handleAddNodeButtonClick}
      >
        {nodeIcon}
        <div className="label">{nodeType}</div>
      </button>
    // </div>
  );
};

