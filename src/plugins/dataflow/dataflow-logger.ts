import { Connection, Control, Node } from "rete";
import { LogEventName } from "../../lib/logger-types";
import { logTileChangeEvent } from "../../models/tiles/log/log-tile-change-event";

type DataflowLogPayload = any; //Node | Connection | Control | object;

interface DataflowProgramChange extends Record<string ,any> {
  targetType: string,
  nodeTypes?: string[],
  nodeIds?: number[],
}

export function dataflowLogEvent( operation: string, payload: DataflowLogPayload, tileId: string ){
  const logEventName = LogEventName.DATAFLOW_TOOL_CHANGE;

  if (payload instanceof Node){
    const n = payload;
    const change: DataflowProgramChange = {
      targetType: 'node',
      nodeTypes: [n.name],
      nodeIds: [n.id]
    };
    logTileChangeEvent(logEventName, { operation, change, tileId });
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
    logTileChangeEvent(logEventName, { operation, change, tileId });
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
      logTileChangeEvent(logEventName, { operation, change, tileId });
    }
  }

  // we pass a plain object for sensor selections
  // so we differentiate by keys sent in object
  else {
    const changeProperties = Object.keys(payload);

    if (changeProperties.includes("sensorTypeValue")){
      const change: DataflowProgramChange = {
        targetType: 'nodedropdown',
        nodeTypes: [payload.node.name],
        nodeIds: [payload.node.id],
        selectItem: "sensorType",
        value: payload.sensorTypeValue
      };
      logTileChangeEvent(logEventName, { operation, change, tileId });
    }

    else if (changeProperties.includes("sensorDataOptionValue")){
      const change: DataflowProgramChange = {
        targetType: 'nodedropdown',
        nodeTypes: [payload.node.name],
        nodeIds: [payload.node.id],
        selectItem: "sensorDataOption",
        value: payload.sensorDataOptionValue
      };
      logTileChangeEvent(logEventName, { operation, change, tileId });
    }
  }
}
