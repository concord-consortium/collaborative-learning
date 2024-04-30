import { uniqueId } from "../../../utilities/js-utils";
import { ConnectionModelSnapshotIn, DataflowNodeSnapshotIn } from "./dataflow-program-model";
import { STATE_VERSION_CURRENT, STATE_VERSION_RETE_V1 } from "./dataflow-state-versions";

export function convertLegacyDataflowProgram(tileId: string, program: any) {
  const version = program.id;

  if (version !== STATE_VERSION_RETE_V1) return program;

  const { nodes, values } = program;

  // Combine the tile id with the node index to make a unique id for the legacy node
  function getUniqueNodeId(legacyId: number) {
    return `${legacyId}@${tileId}`;
  }

  const newNodes: Record<string, DataflowNodeSnapshotIn> = {};
  const connections: Record<string, ConnectionModelSnapshotIn> = {};
  Object.values(nodes).forEach((node: any) => {
    const legacyNodeIdStr = node.id.toString();
    const nodeId = getUniqueNodeId(node.id);
    const data = node.data;
    const nodeValue = values[legacyNodeIdStr]?.currentValues?.nodeValue;
    const nodeValueStr = values[legacyNodeIdStr]?.currentValues?.nodeValue?.toString();
    const nodeProps = getNodeProps(node.name, data, nodeValue);
    newNodes[nodeId] = {
      id: nodeId,
      name: node.name,
      x: node.x,
      y: node.y,
      data: {
        type: node.name,
        plot: data?.plot,
        orderedDisplayName: data?.orderedDisplayName,
        tickEntries: {
          legacyTick: {
            open: true,
            nodeValue: nodeValueStr,
          }
        },
        ...nodeProps
      }
    };
  });

  // Second pass through to add the connections.
  // We do this in two passes so we can look at the source node type if necessary
  Object.values(nodes).forEach((node: any) => {

    // We only look at the inputs because the outputs duplicate them just
    // from the point of view of the other node. And there can only be one
    // connection to an input, so parsing is easier.
    Object.entries(node.inputs).forEach(([targetInput, value]) => {
      const connectionId = uniqueId();
      const inputConnections = Object.values((value as any).connections) as any[];
      if (inputConnections.length === 0) return;
      const inputConnection = inputConnections[0];
      const source = getUniqueNodeId(inputConnection.node);
      const sourceNode = newNodes[source];
      if (!sourceNode) return;

      connections[connectionId] = {
        id: connectionId,
        source,
        // The outputs in the new code were converted from "num" to "value"
        sourceOutput: "value",
        target: getUniqueNodeId(node.id),
        targetInput,
      };
    });
  });

  return {
    id: STATE_VERSION_CURRENT,
    recentTicks: [ "legacyTick" ],
    nodes: newNodes,
    connections,
  };
}

function getNodeProps(nodeType: string, data: any, nodeValue: number | undefined) {
  switch (nodeType) {
    case "Sensor":
      return {
        sensorType: data.type ?? "",
        sensor: data.sensor ?? "",
      };
    case "Number":
      return {
        value: nodeValue ?? 0,
      };
    case "Generator":
      return {
        generatorType: data.generatorType,
        amplitude: data.amplitude,
        period: data.period,
        periodUnits: data.periodUnits,
      };
    case "Timer":
      return {
        timeOn: data.timeOn,
        timeOnUnits: data.timeOnUnits,
        timeOff: data.timeOff,
        timeOffUnits: data.timeOffUnits,
      };
    case "Math":
      return {
        mathOperator: data.mathOperator,
      };
    case "Logic":
      return {
        logicOperator: data.logicOperator,
      };
    case "Transform":
      return {
        transformOperator: data.transformOperator,
      };
    case "Control":
      return {
        controlOperator: data.controlOperator,
        waitDuration: data.waitDuration,
      };
    case "Demo Output":
      return {
        outputType: data.outputType,
      };
    case "Live Output":
      return {
        // The saved data from the old dataflow also includes
        // a outputType in the data
        liveOutputType: data.liveOutputType ?? data.outputType,
        hubSelect: data.hubSelect,
      };
    default:
      // By throwing an error we should stop the document from loading which
      // will prevent it from saving an overwriting the tile
      throw new Error(`Can't find converter for nodeType ${nodeType}`);
  }
}
