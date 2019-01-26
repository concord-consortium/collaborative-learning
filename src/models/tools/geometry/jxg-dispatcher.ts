import { JXGChange, JXGChangeAgent, JXGChangeResult, JXGCreateHandler, JXGObjectType } from "./jxg-changes";
import { boardChangeAgent, isBoard } from "./jxg-board";
import { imageChangeAgent } from "./jxg-image";
import { objectChangeAgent } from "./jxg-object";
import { pointChangeAgent } from "./jxg-point";
import { polygonChangeAgent } from "./jxg-polygon";
import { vertexAngleChangeAgent } from "./jxg-vertex-angle";
import { lineChangeAgent } from "./jxg-line";

interface JXGChangeAgents {
  [key: string]: JXGChangeAgent;
}

const agents: JXGChangeAgents = {
  board: boardChangeAgent,
  image: imageChangeAgent,
  object: objectChangeAgent,
  point: pointChangeAgent,
  polygon: polygonChangeAgent,
  vertexangle: vertexAngleChangeAgent,
  line: lineChangeAgent,
};

export function applyChanges(board: JXG.Board|string, changes: JXGChange[]): JXGChangeResult[] {
  let _board: JXG.Board | undefined;
  const results = changes.map(change => {
                    const result = applyChange(_board || board, change);
                    if ((typeof board === "string") && isBoard(result)) {
                      _board = result as JXG.Board;
                      _board.suspendUpdate();
                    }
                    return result;
                  });
  if (_board) {
    _board.unsuspendUpdate();
  }
  return results;
}

export function applyChange(board: JXG.Board|string, change: JXGChange): JXGChangeResult {
  const target = change.target.toLowerCase();
  if ((change.operation === "update") && (target === "object")) {
    // special case for update/object, where we dispatch by object type
    applyUpdateObjects(board as JXG.Board, change);
    return;
  }
  return dispatchChange(board, change);
}

function applyUpdateObjects(board: JXG.Board, change: JXGChange) {
  const ids = Array.isArray(change.targetID) ? change.targetID : [change.targetID];
  ids.forEach((id, index) => {
    const obj = id && board.objects[id];
    const target = obj ? obj.elType as JXGObjectType : "object";
    const props = Array.isArray(change.properties)
                    ? change.properties[index]
                    : change.properties;
    return dispatchChange(board, {
                            operation: "update",
                            target,
                            targetID: id,
                            parents: change.parents,
                            properties: props
                          });
  });
}

function dispatchChange(board: JXG.Board|string, change: JXGChange): JXGChangeResult {
  const target = change.target.toLowerCase();
  const agent = agents[target];
  const handler = agent && agent[change.operation];
  return handler
          ? (handler as JXGCreateHandler)(board, change)
          : undefined;
}
