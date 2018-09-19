import { JXGChange, JXGChangeAgent } from "./jxg-changes";
import { boardChangeAgent, isBoard } from "./jxg-board";
import { pointChangeAgent } from "./jxg-point";

interface JXGChangeAgents {
  [key: string]: JXGChangeAgent;
}

const agents: JXGChangeAgents = {
  board: boardChangeAgent,
  point: pointChangeAgent
};

export function applyChanges(board: JXG.Board|string, changes: JXGChange[]) {
  let _board: JXG.Board | undefined;
  changes.forEach(change => {
    const result = applyChange(_board || board, change);
    if ((typeof board === "string") && isBoard(result)) {
      _board = result as JXG.Board;
    }
  });
  return _board;
}

export function applyChange(board: JXG.Board|string, change: JXGChange): JXG.Board | undefined {
  const target = change.target.toLowerCase();
  const agent = agents[target];
  const handler = agent && agent[change.operation];
  return handler
          ? handler(board, change)
          : (isBoard(board) ? board : undefined);
}
