import { DocumentModel, DocumentModelType, SaveState } from "./document";
import { ProblemDocument } from "./document-types";
import { kWaitForSaveSettledCapMs, waitForSaveSettled } from "./wait-for-save-settled";

function createDocument(): DocumentModelType {
  return DocumentModel.create({ uid: "u1", type: ProblemDocument, key: "d1" });
}

describe("waitForSaveSettled", () => {
  let document: DocumentModelType;

  beforeEach(() => {
    document = createDocument();
  });

  it("resolves immediately when Idle", async () => {
    document.setSaveState(SaveState.Idle);
    await expect(waitForSaveSettled(document)).resolves.toBeUndefined();
  });

  it("resolves immediately when Saved", async () => {
    document.setSaveState(SaveState.Saved);
    await expect(waitForSaveSettled(document)).resolves.toBeUndefined();
  });

  it("waits through Saving, then resolves once it leaves that state", async () => {
    document.setSaveState(SaveState.Saving);
    const promise = waitForSaveSettled(document);
    let resolved = false;
    promise.then(() => { resolved = true; });

    await Promise.resolve();
    await Promise.resolve();
    expect(resolved).toBe(false);

    document.setSaveState(SaveState.Saved);
    await promise;
    expect(resolved).toBe(true);
  });

  it("waits through Retrying, then resolves once it leaves that state", async () => {
    document.setSaveState(SaveState.Retrying);
    const promise = waitForSaveSettled(document);
    let resolved = false;
    promise.then(() => { resolved = true; });

    await Promise.resolve();
    await Promise.resolve();
    expect(resolved).toBe(false);

    document.setSaveState(SaveState.Saved);
    await promise;
    expect(resolved).toBe(true);
  });

  it("gives up and resolves anyway once the cap elapses", async () => {
    jest.useFakeTimers();
    try {
      document.setSaveState(SaveState.Saving);
      const promise = waitForSaveSettled(document);
      let resolved = false;
      promise.then(() => { resolved = true; });

      jest.advanceTimersByTime(kWaitForSaveSettledCapMs - 1);
      await Promise.resolve();
      expect(resolved).toBe(false);

      jest.advanceTimersByTime(1);
      await promise;
      expect(resolved).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });
});
