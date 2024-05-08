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

  return {
    id: node.id,
    nodeDisplayedName: node.model.orderedDisplayName || "",
    nodeValue: node.getSharedProgramNodeValue(),
    nodeType: node.model.type,
    nodeState: nodeStateData,
    nodeCategory: kNodeTypeToCategoryMap[node.model.type]
  };
}

export function getSharedNodes(nodes: IBaseNode[]): ISharedProgramNode[] {
  return nodes.map(node => convertBaseNodeToSharedNode(node));
}

