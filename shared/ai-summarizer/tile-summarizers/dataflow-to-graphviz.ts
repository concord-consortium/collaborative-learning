interface TickEntry {
  nodeValue?: string;
  open?: boolean;
}

type NodeDataBase = {
  type: string;
  plot?: boolean;
  orderedDisplayName?: string;
  tickEntries?: Record<string, TickEntry>;
};

type NodeDataExtras = NodeDataBase & {
  [key: string]: string | number | boolean | null;
};

type NodeData = {
  [key: string]: string | number | boolean | null | Record<string, TickEntry> | undefined;
};

interface ProgramNode {
  id: string;
  name: string;
  x: number;
  y: number;
  data: NodeData;
}

interface Connection {
  id: string;
  source: string;
  sourceOutput: string;
  target: string;
  targetInput: string;
}

interface Program {
  id: string;
  nodes: Record<string, ProgramNode>;
  connections: Record<string, Connection>;
  recentTicks?: string[];
}

interface NodeInput {
  nodeName: string,
  value?: string
}

interface NodeFormatterContext {
  node: ProgramNode;
  nodeValue: string | undefined;
  inputs: Record<string, NodeInput>;
}

/**
 * Node type formatter - returns a record of property names to values
 */
type NodeFormatter = (context: NodeFormatterContext) => Record<string, string>;

/**
 * Escapes HTML special characters for use in HTML-like labels
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatBinaryOperatorNode(
  context: NodeFormatterContext,
  operatorSymbol: string,
  resultSymbol: string
): Record<string, string> {
  const { nodeValue, inputs } = context;
  // TODO: Should escape some characters in node names so the formula is more clear
  const formula =
    `${inputs.num1?.nodeName || "unset_num1"} ${operatorSymbol} ${inputs.num2?.nodeName || "unset_num2"} ` +
    `${resultSymbol} nodeValue`; // the formula is symbolic, so the result is just "nodeValue"

  // For current values, we'd need the actual input values from connections
  // For now, show placeholder
  const formulaWithValues =
    `${inputs.num1?.value || "unset_num1"} ${operatorSymbol} ${inputs.num2?.value || "unset_num2"} ` +
    `${resultSymbol} ${nodeValue}`;
  return {
    formula,
    formulaWithValues
  };
}
const mathOperatorSymbols: Record<string, string> = {
  'Add': "+",
  'Subtract': "-",
  'Multiply': "×",
  'Divide': "÷",
};
/**
 * Format a Math node
 */
function formatMathNode(context: NodeFormatterContext): Record<string, string> {
  const { node } = context;
  const operator = String(node.data.mathOperator || 'Unknown');

  // Build formula based on operator
  const operatorSymbol = mathOperatorSymbols[operator] || '?';

  return formatBinaryOperatorNode(context, operatorSymbol, '=');
}

const logicOperatorSymbols: Record<string, string> = {
  "Greater Than": ">",
  "Less Than": '<',
  "Greater Than Or Equal To": ">=",
  "Less Than Or Equal To": "<=",
  "Equal": "==",
  "Not Equal": "!=",
  "And": "&&",
  "Or": "||",
  "Nand": "nand",
  "Xor": "xor",
};

/**
 * Format a Logic node
 */
function formatLogicNode(context: NodeFormatterContext): Record<string, string> {
  const { node } = context;
  const operator = String(node.data.logicOperator || 'Unknown');

  // Build formula based on operator
  const operatorSymbol = logicOperatorSymbols[operator] || '?';

  // Using this unicode arrow might confuse some LLMs
  return formatBinaryOperatorNode(context, operatorSymbol, '⇒');
}

function formatUnaryOperatorNode(
  context: NodeFormatterContext,
  numberSentence: (n1: string) => string
): Record<string, string> {
  const { nodeValue, inputs } = context;
  // TODO: Should escape some characters in node names so the formula is more clear
  const formula =
    numberSentence(inputs.num1?.nodeName || "unset_num1") +
    ` nodeValue`; // the formula is symbolic, so the result is just "nodeValue"

  // For current values, we'd need the actual input values from connections
  // For now, show placeholder
  const formulaWithValues =
    numberSentence(inputs.num1?.value || "unset_num1") +
    ` ${nodeValue}`;
  return {
    formula,
    formulaWithValues
  };
}

const transformSentences: Record<string, (n1: string) => string> = {
  "Absolute Value": (n1: string) => `|${n1}| =`,
  "Negation": (n1: string) => `-(${n1}) =`,
  "Not": (n1: string) => `!${n1} ⇒`,
  "Round": (n1: string) => `round(${n1}) =`,
  "Floor": (n1: string) => `floor(${n1}) =`,
  "Ceil": (n1: string) => `ceil(${n1}) =`,
  "Ramp": (n1: string) => `${n1} →`,
};

function formatTransformNode(context: NodeFormatterContext): Record<string, string> {
  const { node } = context;
  const transformType = String(node.data.transformOperator || "Unknown");
  const sentenceFunc = transformSentences[transformType] || ((n1: string) => `unknownTransform(${n1}) =`);
  return formatUnaryOperatorNode(context, sentenceFunc);
}

/**
 * Registry of node type formatters
 */
const nodeFormatters: Record<string, NodeFormatter> = {
  "Math": formatMathNode,
  "Logic": formatLogicNode,
  "Transform": formatTransformNode
};

/**
 * Get the appropriate formatter for a node type
 */
function getNodeFormatter(nodeType: string): NodeFormatter {
  // TODO: it'd be better if each node defined its ports so the AI can tell when ports are not connected
  // This could also provide more description of the ports. For example on the hold node
  // the num2 input should be labeled as "control" or "trigger".
  return nodeFormatters[nodeType] || (() => ({}));
}

/**
 * Convert property record to HTML table rows
 */
function propertiesToTableRows(
  properties: Record<string, string | number | boolean | null | undefined>
): string[] {
  return Object.entries(properties).map(([key, value]) => {
    return `      <tr><td>${escapeHtml(key)}</td><td>${escapeHtml(String(value))}</td></tr>`;
  });
}

/**
 * Converts a dataflow program object to Graphviz DOT format
 * @param program - The dataflow program object
 * @returns A string containing the Graphviz DOT representation
 */
export function programToGraphviz(program: Program): string {
  const lines: string[] = [];

  // Start the digraph
  lines.push('digraph dataflow {');
  lines.push('  rankdir=LR;');
  lines.push('  node [shape=plain];'); // Changed from 'record' to 'plain' for HTML labels
  lines.push('');

  // Create readable node identifiers: [type]:[name][index]
  const nodeIdMap = new Map<string, string>();
  const nodeNameCounts = new Map<string, number>();

  Object.values(program.nodes).forEach(node => {
    const nodeType = node.data.type;
    const nodeName = node.data.orderedDisplayName || node.name;
    const baseId = `${nodeType}:${nodeName}`;

    // Track how many nodes have this type:name combination
    const count = nodeNameCounts.get(baseId) || 0;
    nodeNameCounts.set(baseId, count + 1);

    // Store with temporary count
    const tempId = count === 0 ? baseId : `${baseId}#${count}`;
    nodeIdMap.set(node.id, tempId);
  });

  // Fix up IDs: only add index if there are duplicates
  Object.values(program.nodes).forEach(node => {
    const nodeType = node.data.type;
    const nodeName = node.data.orderedDisplayName || node.name;
    const baseId = `${nodeType}:${nodeName}`;
    const count = nodeNameCounts.get(baseId) || 0;

    if (count === 1) {
      // Remove the #0 for unique names
      nodeIdMap.set(node.id, baseId);
    }
    // Keep the indexed version for duplicates
  });

  const getNodeName = (node: ProgramNode): string => {
    return nodeIdMap.get(node.id) || node.id;
  };

  // Collect all ports (inputs/outputs) for each node from connections
  const nodePorts = new Map<string, {
    inputs: Map<string, ProgramNode>,
    outputs: Map<string, ProgramNode[]>
  }>();

  // Initialize port sets for all nodes
  Object.keys(program.nodes).forEach(nodeId => {
    nodePorts.set(nodeId, { inputs: new Map(), outputs: new Map() });
  });

  // Populate ports from connections
  Object.values(program.connections).forEach(conn => {
    const sourcePorts = nodePorts.get(conn.source);
    const targetPorts = nodePorts.get(conn.target);

    if (sourcePorts) {
      const outputs = sourcePorts.outputs.get(conn.sourceOutput) || [];
      outputs.push(program.nodes[conn.target]);
      sourcePorts.outputs.set(conn.sourceOutput, outputs);
    }
    if (targetPorts) {
      targetPorts.inputs.set(conn.targetInput, program.nodes[conn.source]);
    }
  });

  const recentTicks = program.recentTicks || [];
  const lastTick = recentTicks.length > 0 ? recentTicks[recentTicks.length - 1] : null;

  const getCurrentNodeValue = (node: ProgramNode): string | undefined => {
    const data = node.data as NodeDataBase;
    if (lastTick && data.tickEntries && data.tickEntries[lastTick]) {
      return data.tickEntries[lastTick].nodeValue;
    }
    return undefined;
  };

  // Create nodes with HTML table labels
  Object.values(program.nodes).forEach(node => {
    const ports = nodePorts.get(node.id);
    const nodeBaseData = node.data as NodeDataBase;
    const nodeType = nodeBaseData.type;
    const readableId = getNodeName(node);

    const inputs: NodeFormatterContext["inputs"] = {};
    for (const [input, connectedNode] of ports?.inputs.entries() || []) {
      inputs[input] = {nodeName: getNodeName(connectedNode), value: getCurrentNodeValue(connectedNode)};
    }

    // Get the formatter for this node type
    const {
      type,
      tickEntries: _wrongTypeTickEntries,
      orderedDisplayName,
      ...automaticNodeProperties
    } = (node.data as NodeDataExtras);
    const nodeValue = getCurrentNodeValue(node);
    if (nodeValue !== undefined) {
      automaticNodeProperties.nodeValue = nodeValue;
    }
    const formatter = getNodeFormatter(nodeType);
    const properties = formatter({ node, inputs, nodeValue });
    const propertyRows = propertiesToTableRows({...automaticNodeProperties, ...properties});

    // Build HTML table label
    const labelLines: string[] = [];
    labelLines.push('    <table>');

    // Input ports row (if any)
    if (Object.keys(inputs).length > 0) {
      Object.keys(inputs).forEach(input =>
        labelLines.push(`      <tr><td port="${input}">Input</td><td>${escapeHtml(input)}</td></tr>`)
      );
    }

    // Custom content rows from formatter
    propertyRows.forEach(row => labelLines.push(row));

    // Output ports row (if any)
    const outputPorts = ports ? Array.from(ports.outputs.keys()) : [];
    if (outputPorts.length > 0) {
      outputPorts.forEach(output =>
        labelLines.push(`      <tr><td>Output</td><td port="${output}">${escapeHtml(output)}</td></tr>`)
      );
    }

    labelLines.push('    </table>');

    const htmlLabel = labelLines.join('\n');
    lines.push(`  "${readableId}" [label=<\n${htmlLabel}\n  >];`);
  });

  lines.push('');

  // Create connections
  Object.values(program.connections).forEach(conn => {
    const sourceId = nodeIdMap.get(conn.source) || conn.source;
    const targetId = nodeIdMap.get(conn.target) || conn.target;
    const sourcePort = `"${sourceId}":"${conn.sourceOutput}"`;
    const targetPort = `"${targetId}":"${conn.targetInput}"`;
    lines.push(`  ${sourcePort} -> ${targetPort};`);
  });

  // End the digraph
  lines.push('}');

  return lines.join('\n');
}
