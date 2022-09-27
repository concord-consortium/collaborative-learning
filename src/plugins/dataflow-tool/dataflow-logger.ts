import { LogEventName, Logger, DataflowProgramChange } from "../../lib/logger";
import { Connection, Control, Node } from "rete";

interface DataFlowLogEventParameters {
  operation: string,
  payload: Node | Connection | Control | string,
  tileId: string
}
  /**
   * Logging checklist
   *
   * [x] tile creation and deletion
   * [x] block create, delete
   * [x] block connection/disconnection
   * [ ] value change in control
   * [x] minigraph toggle
   * [ ] minigraph toggle on demo and live output blocks
   * [x] title title change
   *
   * CONTROLS TO GET AT
   * DropdownListControl
   * NumControl
   * PlotButtonControl
   * ValueControl
   * DemoOutputControl
   *
   */

export function dataflowLogEvent( operation: string, payload: Node | Connection | Control | string, tileId: string ){
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
    const ctrl = payload;
    console.log("ABOUT payload is Control: ", ctrl)
  }

  // when it is the title being changed we just pass a string, not a rete object
  if (typeof(payload) === "string"){
    const change: DataflowProgramChange = {
      targetType: 'program',
      programTitle: payload
    };
    Logger.logToolChange(logEventName, operation, change, tileId);
  }
}

