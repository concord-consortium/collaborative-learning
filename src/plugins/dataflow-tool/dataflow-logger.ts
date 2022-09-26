import { LogEventName, Logger, DataflowProgramChange } from "../../lib/logger";
import { Connection, Control, Node } from "rete";

interface DataFlowLogEventParameters {
  operation: string,
  reteObj: Node | Connection | Control,
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
   * [ ] title title change
   */

export function dataflowLogEvent( operation: string, reteObj: Node | Connection | Control, tileId: string ){
  const logEventName = LogEventName.DATAFLOW_TOOL_CHANGE;

  if (reteObj instanceof Node){
    const n = reteObj;
    const change: DataflowProgramChange = {
      nodeTypes: [n.name],
      nodeIds: [n.id],
      changeName: operation,
      targetType: 'node'
    };
    Logger.logToolChange(logEventName, operation, change, tileId);
  }

  if (reteObj instanceof Connection){
    const outputNode = reteObj.output.node as Node
    const inputNode = reteObj.input.node as Node;

    const change: DataflowProgramChange = {
      nodeTypes: [outputNode.name, inputNode.name],
      nodeIds: [outputNode.id, inputNode.id],
      changeName: operation,
      targetType: 'connection',
      connectionOutputNodeId: outputNode.id,
      connectionOutputNodeType: outputNode.name,
      connectionInputNodeId: outputNode.id,
      connectionInputNodeType: outputNode.name
    };
    Logger.logToolChange(logEventName, operation, change, tileId);
  }

  if (reteObj instanceof Control){
    const ctrl = reteObj;
    console.log("ABOUT reteObj is Control: ", ctrl)
  }

}

