import { observable, runInAction } from "mobx";
import { UIModel } from "../models/stores/ui";
import { GroupActivityBroadcaster, kActivityDebounceDelay } from "./group-activity-broadcaster";

describe("GroupActivityBroadcaster", () => {
  let ui: ReturnType<typeof UIModel.create>;
  let persistentUI: { problemWorkspace: { primaryDocumentKey: string | undefined } };
  let user: { currentGroupId: string | undefined };
  let setGroupUserActivity: jest.Mock;
  let clearGroupUserActivity: jest.Mock;
  let setGroupUserActivityOnDisconnect: jest.Mock;
  let onDisconnectCancel: jest.Mock;
  let db: any;
  let broadcaster: GroupActivityBroadcaster;

  beforeEach(() => {
    jest.useFakeTimers();

    ui = UIModel.create({
      learningLogWorkspace: { type: "learningLog", mode: "1-up" }
    });
    persistentUI = observable({
      problemWorkspace: observable({ primaryDocumentKey: undefined as string | undefined })
    });
    user = observable({ currentGroupId: "group-1" as string | undefined });

    setGroupUserActivity = jest.fn().mockResolvedValue(undefined);
    clearGroupUserActivity = jest.fn().mockResolvedValue(undefined);
    onDisconnectCancel = jest.fn();
    setGroupUserActivityOnDisconnect = jest.fn(() => ({ cancel: onDisconnectCancel }));

    db = {
      stores: { ui, persistentUI, user },
      setGroupUserActivity,
      clearGroupUserActivity,
      setGroupUserActivityOnDisconnect
    };

    broadcaster = new GroupActivityBroadcaster(db);
  });

  afterEach(() => {
    broadcaster.stop();
    jest.useRealTimers();
  });

  it("writes activity when selection becomes non-empty in a doc", () => {
    broadcaster.start();

    runInAction(() => {
      persistentUI.problemWorkspace.primaryDocumentKey = "doc-1";
      ui.setSelectedTileId("tile-a");
    });

    jest.advanceTimersByTime(kActivityDebounceDelay);

    expect(setGroupUserActivity).toHaveBeenCalledTimes(1);
    expect(setGroupUserActivity).toHaveBeenCalledWith({
      documentKey: "doc-1",
      focus: { tileIds: ["tile-a"] }
    });
    expect(clearGroupUserActivity).not.toHaveBeenCalled();
  });

  it("clears activity when selection empties", () => {
    broadcaster.start();

    runInAction(() => {
      persistentUI.problemWorkspace.primaryDocumentKey = "doc-1";
      ui.setSelectedTileId("tile-a");
    });
    jest.advanceTimersByTime(kActivityDebounceDelay);
    expect(setGroupUserActivity).toHaveBeenCalledTimes(1);

    ui.clearSelectedTiles();
    jest.advanceTimersByTime(kActivityDebounceDelay);

    expect(clearGroupUserActivity).toHaveBeenCalledTimes(1);
  });

  it("clears activity when document key becomes undefined", () => {
    broadcaster.start();

    runInAction(() => {
      persistentUI.problemWorkspace.primaryDocumentKey = "doc-1";
      ui.setSelectedTileId("tile-a");
    });
    jest.advanceTimersByTime(kActivityDebounceDelay);
    expect(setGroupUserActivity).toHaveBeenCalledTimes(1);

    runInAction(() => {
      persistentUI.problemWorkspace.primaryDocumentKey = undefined;
    });
    jest.advanceTimersByTime(kActivityDebounceDelay);

    expect(clearGroupUserActivity).toHaveBeenCalledTimes(1);
  });

  it("debounces rapid selection changes", () => {
    broadcaster.start();

    runInAction(() => {
      persistentUI.problemWorkspace.primaryDocumentKey = "doc-1";
      ui.setSelectedTileId("tile-a");
    });
    jest.advanceTimersByTime(kActivityDebounceDelay / 3);
    ui.setSelectedTileId("tile-b");
    jest.advanceTimersByTime(kActivityDebounceDelay / 3);
    ui.setSelectedTileId("tile-c");

    // Less than kActivityDebounceDelay ms since the last change — no flush yet.
    expect(setGroupUserActivity).not.toHaveBeenCalled();

    jest.advanceTimersByTime(kActivityDebounceDelay);

    expect(setGroupUserActivity).toHaveBeenCalledTimes(1);
    expect(setGroupUserActivity).toHaveBeenCalledWith({
      documentKey: "doc-1",
      focus: { tileIds: ["tile-c"] }
    });
  });

  it("registers onDisconnect on first write", () => {
    broadcaster.start();

    runInAction(() => {
      persistentUI.problemWorkspace.primaryDocumentKey = "doc-1";
      ui.setSelectedTileId("tile-a");
    });
    jest.advanceTimersByTime(kActivityDebounceDelay);
    expect(setGroupUserActivityOnDisconnect).toHaveBeenCalledTimes(1);

    // A second write should not register the handler again.
    ui.setSelectedTileId("tile-b");
    jest.advanceTimersByTime(kActivityDebounceDelay);
    expect(setGroupUserActivity).toHaveBeenCalledTimes(2);
    expect(setGroupUserActivityOnDisconnect).toHaveBeenCalledTimes(1);
  });

  it("dispose() tears down reactions and onDisconnect", () => {
    broadcaster.start();

    runInAction(() => {
      persistentUI.problemWorkspace.primaryDocumentKey = "doc-1";
      ui.setSelectedTileId("tile-a");
    });
    jest.advanceTimersByTime(kActivityDebounceDelay);
    expect(setGroupUserActivityOnDisconnect).toHaveBeenCalledTimes(1);

    broadcaster.stop();

    expect(onDisconnectCancel).toHaveBeenCalledTimes(1);

    // After stop, further mutations should not trigger writes.
    setGroupUserActivity.mockClear();
    ui.setSelectedTileId("tile-b");
    jest.advanceTimersByTime(kActivityDebounceDelay);
    expect(setGroupUserActivity).not.toHaveBeenCalled();
  });
});
