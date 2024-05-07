import {
  ISharedProgramNode, kNodeTypeToCategoryMap, kSharedNodeKeys
 } from "../../../shared-program-data/shared-program-data";
import { IBaseNode } from "../base-node";

export function convertBaseNodeToSharedNode(node: IBaseNode): ISharedProgramNode {
  const nodeStateData = {};
  Object.keys(node.model).forEach(key => {
    if (kSharedNodeKeys.includes(key)) {
      (nodeStateData as any)[key] = (node.model as any)[key];
    }
  });

  // Many node types have particular display methods we need to access to pass a good value to shared program nodes
  let miniNodeDisplayValue = "";
  if (node.model.type === "Sensor" && typeof node.getDisplayValue !== 'undefined') {
    miniNodeDisplayValue = node.getDisplayValue();
  } else if (node.model.type === "Live Output" && typeof node.getDisplayMessage !== 'undefined') {
    miniNodeDisplayValue = node.getDisplayMessage();
  } else if (node.model.type === "Demo Output" && typeof node.getNodeValueDisplayMessage !== 'undefined') {
    miniNodeDisplayValue = node.getNodeValueDisplayMessage();
  } else if (node.model.type === "Timer" && typeof node.getSentence !== 'undefined') {
    miniNodeDisplayValue = node.getSentence();
  } else {
    // if NaN or undefined, display empty string
    if (typeof node.model.nodeValue === 'undefined') {
      miniNodeDisplayValue = "";
    } else if (node.model.nodeValue && isNaN(node.model.nodeValue)) {
      miniNodeDisplayValue = "";
    } else if (isFinite(node.model.nodeValue)) {
      const modelVal = node.model.nodeValue;
      miniNodeDisplayValue = Number.isInteger(modelVal) ? modelVal.toString() : modelVal.toFixed(2);
    }
  }

  return {
    id: node.id,
    nodeDisplayedName: node.model.orderedDisplayName || "",
    nodeValue: miniNodeDisplayValue,
    nodeType: node.model.type,
    nodeState: nodeStateData,
    nodeCategory: kNodeTypeToCategoryMap[node.model.type]
  };
}

export function getSharedNodes(nodes: IBaseNode[]): ISharedProgramNode[] {
  return nodes.map(node => convertBaseNodeToSharedNode(node));
}

