import { LogEventName, Logger, DataflowProgramChange } from "../../lib/logger";
import { Connection, Control, Node } from "rete";
import { string } from "@concord-consortium/mobx-state-tree/dist/internal";

interface DataFlowLogEventParameters {
  operation: string, // but could be enumerated as "nodecreated", "noderemoved" etc
  reteObj: Node | Connection | Control,
  tileId: string
} // Logging Question - TypeScript
  // I feel that something like the above should exist and be passed in below...but not sure what I am after


  /**
   * Logging checklist
   *
   * [x] tile creation and deletion
   * [x] block create, delete
   * [ ] block connection
   * [ ] value change in control
   * [ ] minigraph toggle
   * [ ] title title change
   */

export function dataflowLogEvent( operation: string, reteObj: Node | Connection | Control, tileId: string ){
  const logEventName = LogEventName.DATAFLOW_TOOL_CHANGE;

  if (reteObj instanceof Node){
    const n = reteObj;
    const change: DataflowProgramChange = {
      nodeType: [n.name],
      changeName: operation,
      reteTargetType: 'node',
      nodeId: [n.id],
      nodeValue: n.data.nodeValue as string,
      targetValue: n.data.nodeValue as string,  // same as above because target is node
    };
    Logger.logToolChange(logEventName, operation, change, tileId);
  }

  if (reteObj instanceof Connection){
    const outputNode = reteObj.output.node as Node
    const inputNode = reteObj.input.node as Node;

    console.log("ABOUT outputNode: ", outputNode)
    console.log("ABOUT : ", inputNode)

    const change: DataflowProgramChange = {
      nodeType: [outputNode.name, inputNode.name], // redundant but keeps comprable values at top level across event categories
      changeName: operation,
      reteTargetType: 'connection',
      nodeId: [outputNode.id, inputNode.id], // redundant but keeps comprable values at top level accross event categories
      connectionOutputNodeId: outputNode.id,
      connectionOutputNodeType: outputNode.name,
      connectionInputNodeId: outputNode.id,
      connectionInputNodeType: outputNode.name
    };
    console.log("change: ", change)
    Logger.logToolChange(logEventName, operation, change, tileId);
  }

  if (reteObj instanceof Control){
    // log action user takes on a node controls
    // these will originate in node control code or maybe node factories if lucky

    const ctrl = reteObj;

    console.log("ABOUT reteObj is Control: ", reteObj)
  }
}

