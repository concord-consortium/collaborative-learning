import { castArray } from "lodash";
import { JXGChange, JXGChangeAgent, JXGChangeResult, JXGCreateHandler, JXGObjectType, IChangeContext
        } from "./jxg-changes";
import {
  boardChangeAgent, getObjectById, kReverse, resumeBoardUpdates, sortByCreation, suspendBoardUpdates
} from "./jxg-board";
import { commentChangeAgent } from "./jxg-comment";
import { imageChangeAgent } from "./jxg-image";
import { movableLineChangeAgent } from "./jxg-movable-line";
import { objectChangeAgent } from "./jxg-object";
import { pointChangeAgent } from "./jxg-point";
import { polygonChangeAgent } from "./jxg-polygon";
import { linkedPointChangeAgent, tableLinkChangeAgent } from "./jxg-table-link";
import { isBoard } from "./jxg-types";
import { vertexAngleChangeAgent } from "./jxg-vertex-angle";
import { castArrayCopy } from "../../../utilities/js-utils";
import { circleChangeAgent } from "./jxg-circle";
import { lineChangeAgent } from "./jxg-line";

type OnWillApplyChange = (board: JXG.Board | string, change: JXGChange) => false | undefined;
type OnDidApplyChange = (board: JXG.Board | undefined, change: JXGChange) => void;

interface JXGChangeAgents {
  [key: string]: JXGChangeAgent;
}

const agents: JXGChangeAgents = {
  board: boardChangeAgent,
  circle: circleChangeAgent,
  comment: commentChangeAgent,
  image: imageChangeAgent,
  infiniteline: lineChangeAgent,
  line: lineChangeAgent,
  linkedpoint: linkedPointChangeAgent,
  movableline: movableLineChangeAgent,
  object: objectChangeAgent,
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
                    const resultBoard = castArray(result).find(isBoard);
                    if ((typeof board === "string") && resultBoard) {
                      _board = resultBoard;
                      suspendBoardUpdates(_board);
                    }
                    return result;
                  });
  if (_board) {
    resumeBoardUpdates(_board);
  }
  return results;
}

export function applyChange(board: JXG.Board|string, change: JXGChange,
                            context?: IDispatcherChangeContext): JXGChangeResult {
  let _board = board as JXG.Board;
  const target = change.target.toLowerCase();

  // give clients a chance to intercede before the change is applied
  if (context?.onWillApplyChange?.(board, change) === false) return;

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
  if (context?.onDidApplyChange) {
    if (isBoard(result)) _board = result;
    else if (Array.isArray(result) && isBoard(result?.[0])) _board = result[0];
    context.onDidApplyChange(_board, change);
  }

  return result;
}

function applyUpdateObjects(board: JXG.Board, change: JXGChange, context?: IChangeContext) {
  const ids = castArray(change.targetID);
  ids.forEach((id, index) => {
    const obj = id && getObjectById(board, id);
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
    const obj = id && getObjectById(board, id);
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
