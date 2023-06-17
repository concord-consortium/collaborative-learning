import { Node } from "rete";
import { VariableType } from "@concord-consortium/diagram-view";

import { getOutputType } from "../../nodes/utilities/live-output-utilities";

export const kOutputVariablePrefix = "output_";

export function isOutputVariable(variable: VariableType) {
  return variable.name?.startsWith(kOutputVariablePrefix);
}

function outputVariableNamePart(variable: VariableType) {
  return variable.name?.slice(kOutputVariablePrefix.length);
}

// Returns possible names to match with a shared variable based on the given node's outputType.
// This is so output_LightBulb, output_lightbulb, output_light_bulb, etc will all match.
function outputNamesToMatch(node: Node) {
  const lowerName = getOutputType(node)?.toLowerCase();
  const underscoreName = lowerName.replace(" ", "_");
  const noSpaceName = lowerName.replace(" ", "");
  return [underscoreName, noSpaceName];
}

function outputNameMatches(names: string[], variable:VariableType) {
  const variableName = outputVariableNamePart(variable)?.toLowerCase();
  return variableName && names.includes(variableName);
}

export function findOutputVariable(node: Node, variables?: VariableType[]) {
  if (!variables) return undefined;
  const names = outputNamesToMatch(node);
  return variables?.find((variable: VariableType) => outputNameMatches(names, variable));
}
