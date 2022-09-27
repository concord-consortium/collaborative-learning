import { LogEventName, Logger, DataflowProgramChange } from "../../lib/logger";
import { Connection, Control, Node } from "rete";

type DataflowLogPayload =  Node | Connection | Control | string;

  /**
   * Logging checklist
   *
   * [x] tile creation and deletion
   * [x] block create, delete
   * [x] block connection/disconnection
   * [x] minigraph toggle
   * [x] minigraph toggle on demo and live output blocks
   * [x] title title change
   * [ ] clicks and value changes in controls below
   *
   * CONTROLS TO GET AT
   * [x] DropdownListControl
   * [ ] NumControl
   * [ ] PlotButtonControl
   * [ ] DemoOutputControl (prob not)
   * [ ] SensorSelectControl
   * [ ] SensorValueControl
   */

export function dataflowLogEvent( operation: string, payload: DataflowLogPayload, tileId: string ){
  const logEventName = LogEventName.DATAFLOW_TOOL_CHANGE;

  if (payload instanceof Node){
    const n = payload;
    const change: DataflowProgramChange = {
      targetType: 'node',
      nodeTypes: [n.name],
      nodeIds: [n.id]
    };
    Logger.logToolChange(logEventName, operation, change, tileId);
  }

  if (payload instanceof Connection){
    const outputNode = payload.output.node as Node
    const inputNode = payload.input.node as Node;

    const change: DataflowProgramChange = {
      targetType: 'connection',
      nodeTypes: [outputNode.name, inputNode.name],
      nodeIds: [outputNode.id, inputNode.id],
      connectionOutputNodeId: outputNode.id,
      connectionOutputNodeType: outputNode.name,
      connectionInputNodeId: inputNode.id,
      connectionInputNodeType: inputNode.name
    };
    Logger.logToolChange(logEventName, operation, change, tileId);
  }

  if (payload instanceof Control){
    const ctrl = payload as Control;
    const node = payload.parent as Node;

    if (ctrl && node){
      const change: DataflowProgramChange = {
        targetType: 'nodedropdown',
        nodeTypes: [node.name],
        nodeIds: [node.id],
        selectItem: ctrl.key,
        fieldValue: (ctrl as any).props.value,
        fieldUnits: (ctrl as any).props.currentUnits || ""
      };
      Logger.logToolChange(logEventName, operation, change, tileId);
    }
  }

  // title is not a rete object
  if (typeof(payload) === "string"){
    const change: DataflowProgramChange = {
      targetType: 'program',
      programTitle: payload
    };
    Logger.logToolChange(logEventName, operation, change, tileId);
  }
}

