import { NodeEditorMST } from "../node-editor-mst";

export const kEmptyValueString = "__";

export function getNewNodePosition(editor: NodeEditorMST) {
  const kNodesPerColumn = 5;
  const kNodesPerRow = 4;
  const kColumnWidth = 200;
  const kRowHeight = 90;
  const kLeftMargin = 40;
  const kTopMargin = 5;
  const kColumnOffset = 15;

  const numNodes = editor.getNodes().length;
  const { k } = editor.area.area.transform;
  const nodePos: [number, number] =
    [kLeftMargin * (1 / k) + Math.floor((numNodes % (kNodesPerColumn * kNodesPerRow)) / kNodesPerColumn)
      * kColumnWidth + Math.floor(numNodes / (kNodesPerColumn * kNodesPerRow)) * kColumnOffset,
    kTopMargin + numNodes % kNodesPerColumn * kRowHeight];
  return nodePos;
}

export function getNumDisplayStr(n: number){
  return isNaN(n) ? kEmptyValueString : Number(n).toFixed(3).replace(/\.?0+$/, "");
}
