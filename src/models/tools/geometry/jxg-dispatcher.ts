import { JXGChange, JXGChangeAgent, JXGChangeResult, JXGCreateHandler, JXGObjectType, IChangeContext } from "./jxg-changes";
import { boardChangeAgent, isBoard, kReverse, sortByCreation } from "./jxg-board";
import { commentChangeAgent } from "./jxg-comment";
import { imageChangeAgent } from "./jxg-image";
import { movableLineChangeAgent } from "./jxg-movable-line";
import { objectChangeAgent } from "./jxg-object";
import { pointChangeAgent } from "./jxg-point";
import { polygonChangeAgent } from "./jxg-polygon";
import { linkedPointChangeAgent, tableLinkChangeAgent } from "./jxg-table-link";
import { vertexAngleChangeAgent } from "./jxg-vertex-angle";
import { castArrayCopy } from "../../../utilities/js-utils";
import { castArray } from "lodash";

type OnWillApplyChange = (board: JXG.Board | string, change: JXGChange) => void;
type OnDidApplyChange = (board: JXG.Board | undefined, change: JXGChange) => void;

interface JXGChangeAgents {
  [key: string]: JXGChangeAgent;
}

const agents: JXGChangeAgents = {
  board: boardChangeAgent,
  comment: commentChangeAgent,
  image: imageChangeAgent,
  linkedpoint: linkedPointChangeAgent,
  object: objectChangeAgent,
  movableline: movableLineChangeAgent,
  point: pointChangeAgent,
  polygon: polygonChangeAgent,
  tablelink: tableLinkChangeAgent,
  vertexangle: vertexAngleChangeAgent
};

export interface IDispatcherChangeContext extends IChangeContext {
  onWillApplyChange?: OnWillApplyChange;
  onDidApplyChange?: OnDidApplyChange;
}

export function applyChanges(board: JXG.Board|string, changes: JXGChange[],
                             context?: IDispatcherChangeContext): JXGChangeResult[] {
  let _board: JXG.Board | undefined;
  const results = changes.map(change => {
                    const result = applyChange(_board || board, change, context);
                    const resultBoard = castArray(result).find(isBoard) as JXG.Board;
                    if ((typeof board === "string") && resultBoard) {
                      _board = resultBoard;
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
                            context?: IDispatcherChangeContext): JXGChangeResult {
  let _board = board as JXG.Board;
  const target = change.target.toLowerCase();

  // give clients a chance to intercede before the change is applied
  if (context && context.onWillApplyChange) {
    context.onWillApplyChange(board, change);
  }

  // special case for update/object, where we dispatch by object type
  if ((change.operation === "update") && (target === "object")) {
    applyUpdateObjects(_board, change, context);
    return;
  }
  // special case for delete/object, where we dispatch by object type
  if ((change.operation === "delete") && (target === "object")) {
    applyDeleteObjects(_board, change, context);
    return;
  }
  const result = dispatchChange(board, change, context);

  // give clients a chance to intercede after the change has been applied
  if (context && context.onDidApplyChange) {
    if (isBoard(result)) _board = result as JXG.Board;
    context.onDidApplyChange(_board, change);
  }

  return result;
}

function applyUpdateObjects(board: JXG.Board, change: JXGChange, context?: IChangeContext) {
  const ids = castArray(change.targetID);
  ids.forEach((id, index) => {
    const obj = id && board.objects[id];
    const target = obj
            ? obj.getAttribute("clientType") || obj.elType as JXGObjectType
            : "object";
    const props = Array.isArray(change.properties)
                    ? change.properties[index]
                    : change.properties;
    dispatchChange(board, {
                    operation: "update",
                    target,
                    targetID: id,
                    parents: change.parents,
                    properties: props,
                    links: change.links
                  }, context);
  });
}

function applyDeleteObjects(board: JXG.Board, change: JXGChange, context?: IChangeContext) {
  const ids = castArrayCopy(change.targetID);
  sortByCreation(board, ids, kReverse);
  ids.forEach(id => {
    const obj = id && board.objects[id];
    const target = obj
            ? obj.getAttribute("clientType") || obj.elType as JXGObjectType
            : "object";
    if (obj) {
      dispatchChange(board, {
                      operation: "delete",
                      target,
                      targetID: id,
                      links: change.links
                    }, context);
    }
  });
}

function dispatchChange(board: JXG.Board|string, change: JXGChange, context?: IChangeContext): JXGChangeResult {
  const target = change.target.toLowerCase();
  const agent = agents[target];
  const handler = agent && agent[change.operation];
  return handler
          ? (handler as JXGCreateHandler)(board, change, context)
          : undefined;
}
