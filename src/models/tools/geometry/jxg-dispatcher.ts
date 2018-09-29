import { JXGChange, JXGChangeAgent, JXGChangeResult, JXGCreateHandler } from "./jxg-changes";
import { boardChangeAgent, isBoard } from "./jxg-board";
import { objectChangeAgent } from "./jxg-object";
import { pointChangeAgent } from "./jxg-point";
import { polygonChangeAgent } from "./jxg-polygon";

interface JXGChangeAgents {
  [key: string]: JXGChangeAgent;
}

const agents: JXGChangeAgents = {
  board: boardChangeAgent,
  object: objectChangeAgent,
  point: pointChangeAgent,
  polygon: polygonChangeAgent
};

export function applyChanges(board: JXG.Board|string, changes: JXGChange[]): JXGChangeResult[] {
  let _board: JXG.Board | undefined;
  return changes.map(change => {
          const result = applyChange(_board || board, change);
          if ((typeof board === "string") && isBoard(result)) {
            _board = result as JXG.Board;
          }
          return result;
        });
}

export function applyChange(board: JXG.Board|string, change: JXGChange): JXGChangeResult {
  const target = change.target.toLowerCase();
  const agent = agents[target];
  const handler = agent && agent[change.operation];
  return handler
          ? (handler as JXGCreateHandler)(board, change)
          : undefined;
}
