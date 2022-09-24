import { LogEventName, Logger, DataflowProgramChange } from "../../lib/logger";
import { Connection, Control, Node } from "rete";

export function dataflowLogEvent( operation: string, reteObj: Node | Connection | Control, id: string){
  const logEventName = LogEventName.DATAFLOW_TOOL_CHANGE;

  if (reteObj instanceof Node){
    const change: DataflowProgramChange = {
      nodeType: reteObj.name,
      nodeId: reteObj.id,
      changeTarget: 'node',
      changeValue: operation
    };
    Logger.logToolChange(logEventName, operation, change, id);
  }

  if (reteObj instanceof Connection){
    const change: DataflowProgramChange = {
      nodeType: 'foo', // you will need to climb out to find node type and id from connection obj
      nodeId: 123,
      changeTarget: 'connection',
      changeValue: operation
    };
    Logger.logToolChange(logEventName, operation, change, id);
  }

  if (reteObj instanceof Control){
    console.log("log user action on node controls")
    // log action user takes on a node controls
    // these will originate in node control code or maybe node factories if lucky
  }
}

