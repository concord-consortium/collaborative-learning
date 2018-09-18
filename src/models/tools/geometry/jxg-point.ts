import { JXGChangeAgent } from "./jxg-changes";

export const pointChangeAgent: JXGChangeAgent = {
  create: (board, change) => {
    const point = (board as JXG.Board).create("point", change.parents, change.properties);
    return board;
  },

  update: (board, change) => {
    return board;
  },

  delete: (board, change) => {
    return board;
  }
};
