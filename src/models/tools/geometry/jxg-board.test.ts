import { resumeBoardUpdates, suspendBoardUpdates } from "./jxg-board";

describe("suspendBoardUpdates/resumeBoardUpdates", () => {

  const suspendUpdate = jest.fn();
  const unsuspendUpdate = jest.fn();

  let board: any;

  beforeEach(() => {
    suspendUpdate.mockReset();
    unsuspendUpdate.mockReset();
    board = { suspendCount: 0, suspendUpdate, unsuspendUpdate };
  });

  it("ignores requests to resume updates for a board that hasn't been suspended", () => {
    jestSpyConsole("warn", spy => {
      resumeBoardUpdates(board);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(unsuspendUpdate).not.toHaveBeenCalled();
    });
  });

  it("non-nested suspend/resume of updates should work", () => {
    suspendBoardUpdates(board);
    expect(suspendUpdate).toHaveBeenCalledTimes(1);
    expect(unsuspendUpdate).not.toHaveBeenCalled();
    resumeBoardUpdates(board);
    expect(suspendUpdate).toHaveBeenCalledTimes(1);
    expect(unsuspendUpdate).toHaveBeenCalledTimes(1);
  });

  it("nested suspend/resume of updates should work", () => {
    suspendBoardUpdates(board);
    expect(suspendUpdate).toHaveBeenCalledTimes(1);
    expect(unsuspendUpdate).not.toHaveBeenCalled();
    suspendBoardUpdates(board);
    expect(suspendUpdate).toHaveBeenCalledTimes(1);
    expect(unsuspendUpdate).not.toHaveBeenCalled();
    resumeBoardUpdates(board);
    expect(suspendUpdate).toHaveBeenCalledTimes(1);
    expect(unsuspendUpdate).not.toHaveBeenCalled();
    resumeBoardUpdates(board);
    expect(suspendUpdate).toHaveBeenCalledTimes(1);
    expect(unsuspendUpdate).toHaveBeenCalledTimes(1);
  });
});
