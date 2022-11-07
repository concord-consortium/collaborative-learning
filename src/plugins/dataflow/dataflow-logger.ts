import { LogEventName, Logger, DataflowProgramChange } from "../../lib/logger";
import { Connection, Control, Node } from "rete";

type DataflowLogPayload = any; //Node | Connection | Control | object;

export function dataflowLogEvent( operation: string, payload: DataflowLogPayload, tileId: string ){
  const logEventName = LogEventName.DATAFLOW_TOOL_CHANGE;

  if (payload instanceof Node){
    const n = payload;
    const change: DataflowProgramChange = {
      targetType: 'node',
      nodeTypes: [n.name],
      nodeIds: [n.id]
    };
    Logger.logTileChange(logEventName, operation, change, tileId);
  }

  else if (payload instanceof Connection){
    const outputNode = payload.output.node as Node;
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
    Logger.logTileChange(logEventName, operation, change, tileId);
  }

  else if (payload instanceof Control){
    const ctrl = payload as Control;
    const node = payload.parent as Node;

    if (ctrl && node){
      const change: DataflowProgramChange = {
        targetType: 'nodedropdown',
        nodeTypes: [node.name],
        nodeIds: [node.id],
        selectItem: ctrl.key,
        value: (ctrl as any).props.value,
        units: (ctrl as any).props.currentUnits || ""
      };
      Logger.logTileChange(logEventName, operation, change, tileId);
    }
  }

  // we pass a plain object for title change and sensor selections
  // so we differentiate by keys sent in object
  else {
    const changeProperties = Object.keys(payload);

    if (changeProperties.includes("programTitleValue")){
      const change: DataflowProgramChange = {
        targetType: 'program',
        programTitle: payload.programTitleValue
      };
      Logger.logTileChange(logEventName, operation, change, tileId);
    }

   else if (changeProperties.includes("sensorTypeValue")){
      const change: DataflowProgramChange = {
        targetType: 'nodedropdown',
        nodeTypes: [payload.node.name],
        nodeIds: [payload.node.id],
        selectItem: "sensorType",
        value: payload.sensorTypeValue
      };
      Logger.logTileChange(logEventName, operation, change, tileId);
    }

    else if (changeProperties.includes("sensorDataOptionValue")){
      const change: DataflowProgramChange = {
        targetType: 'nodedropdown',
        nodeTypes: [payload.node.name],
        nodeIds: [payload.node.id],
        selectItem: "sensorDataOption",
        value: payload.sensorDataOptionValue
      };
      Logger.logTileChange(logEventName, operation, change, tileId);
    }
  }
}
