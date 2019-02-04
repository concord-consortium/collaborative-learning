import { JXGChange, JXGChangeAgent, JXGChangeResult, JXGCreateHandler, JXGObjectType } from "./jxg-changes";
import { boardChangeAgent, isBoard } from "./jxg-board";
import { imageChangeAgent } from "./jxg-image";
import { objectChangeAgent } from "./jxg-object";
import { pointChangeAgent } from "./jxg-point";
import { polygonChangeAgent } from "./jxg-polygon";
import { linkedPointChangeAgent, tableLinkChangeAgent } from "./jxg-table-link";
import { vertexAngleChangeAgent } from "./jxg-vertex-angle";
import { movableLineChangeAgent } from "./jxg-movable-line";
import { castArray } from "lodash";

type OnChangeApplied = (board: JXG.Board | undefined, change: JXGChange) => void;

interface JXGChangeAgents {
  [key: string]: JXGChangeAgent;
}

const agents: JXGChangeAgents = {
  board: boardChangeAgent,
  image: imageChangeAgent,
  linkedpoint: linkedPointChangeAgent,
  object: objectChangeAgent,
  movableline: movableLineChangeAgent,
  point: pointChangeAgent,
  polygon: polygonChangeAgent,
  tablelink: tableLinkChangeAgent,
  vertexangle: vertexAngleChangeAgent
};

export function applyChanges(board: JXG.Board|string, changes: JXGChange[],
                             onChangeApplied?: OnChangeApplied): JXGChangeResult[] {
  let _board: JXG.Board | undefined;
  const results = changes.map(change => {
                    const result = applyChange(_board || board, change, onChangeApplied);
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

export function applyChange(board: JXG.Board|string, change: JXGChange,
                            onChangeApplied?: OnChangeApplied): JXGChangeResult {
  const target = change.target.toLowerCase();
  if ((change.operation === "update") && (target === "object")) {
    // special case for update/object, where we dispatch by object type
    applyUpdateObjects(board as JXG.Board, change);
    return;
  }
  if ((change.operation === "delete") && (target === "object")) {
    // special case for delete/object, where we dispatch by object type
    applyDeleteObjects(board as JXG.Board, change);
    return;
  }
  const result = dispatchChange(board, change);
  if (onChangeApplied) {
    const _board = isBoard(result)
                    ? result as JXG.Board
                    : isBoard(board) ? board as JXG.Board : undefined;
    onChangeApplied(_board, change);
  }
  return result;
}

function applyUpdateObjects(board: JXG.Board, change: JXGChange) {
  const ids = castArray(change.targetID);
  ids.forEach((id, index) => {
    const obj = id && board.objects[id];
    const target = obj
            ? obj.getAttribute("clientType") || obj.elType as JXGObjectType
            : "object";
    const props = Array.isArray(change.properties)
                    ? change.properties[index]
                    : change.properties;
    return dispatchChange(board, {
                            operation: "update",
                            target,
                            targetID: id,
                            parents: change.parents,
                            properties: props,
                            links: change.links
                          });
  });
}

function applyDeleteObjects(board: JXG.Board, change: JXGChange) {
  const ids = castArray(change.targetID);
  ids.forEach(id => {
    const obj = id && board.objects[id];
    const target = obj
            ? obj.getAttribute("clientType") || obj.elType as JXGObjectType
            : "object";
    return dispatchChange(board, {
                            operation: "delete",
                            target,
                            targetID: id,
                            links: change.links
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
