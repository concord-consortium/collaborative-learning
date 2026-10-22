import { retryAbortedTransaction } from "./retry-aborted-transaction";

const setAbort = () => new Error("set");

describe("retryAbortedTransaction", () => {
  it("runs the transaction once when it succeeds", async () => {
    const run = jest.fn().mockResolvedValue(undefined);
    await retryAbortedTransaction(run);
    expect(run).toHaveBeenCalledTimes(1);
  });

  // The groups listener sets a student's group while the modal's transaction is in flight, which
  // aborts it. The move is safe to apply again against whatever the set wrote.
  it("runs it again when a concurrent set aborts it", async () => {
    const run = jest.fn()
      .mockRejectedValueOnce(setAbort())
      .mockResolvedValue(undefined);
    await retryAbortedTransaction(run);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("gives up after the retries are spent, and reports the abort", async () => {
    const run = jest.fn().mockRejectedValue(setAbort());
    await expect(retryAbortedTransaction(run, 2)).rejects.toThrow("set");
    expect(run).toHaveBeenCalledTimes(3);
  });

  // Anything else is a real failure; retrying would only hide it.
  it("does not retry any other failure", async () => {
    const run = jest.fn().mockRejectedValue(new Error("permission_denied"));
    await expect(retryAbortedTransaction(run)).rejects.toThrow("permission_denied");
    expect(run).toHaveBeenCalledTimes(1);
  });
});
