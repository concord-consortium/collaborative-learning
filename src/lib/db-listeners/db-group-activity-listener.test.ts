import { observable, runInAction } from "mobx";
import { GroupActivityModel } from "../../models/stores/group-activity";
import { DBGroupActivityListener } from "./db-group-activity-listener";

describe("DBGroupActivityListener", () => {
  const fakeUser = { id: "user-1" };
  const groupPath = "classes/abc/offerings/123/groups/group-1";

  let groupActivity: ReturnType<typeof GroupActivityModel.create>;
  let onMock: jest.Mock;
  let offMock: jest.Mock;
  let refMock: jest.Mock;
  let getGroupPathMock: jest.Mock;
  let usersRef: { on: jest.Mock; off: jest.Mock; toString: () => string };
  let capturedHandler: ((snapshot: { val: () => any }) => void) | null;
  let user: { currentGroupId: string | undefined; id: string };
  let db: any;

  beforeEach(() => {
    groupActivity = GroupActivityModel.create({});
    capturedHandler = null;
    onMock = jest.fn((event: string, cb: (snapshot: { val: () => any }) => void) => {
      capturedHandler = cb;
    });
    offMock = jest.fn();
    usersRef = { on: onMock, off: offMock, toString: () => `${groupPath}/users` };
    refMock = jest.fn(() => usersRef);
    getGroupPathMock = jest.fn(() => groupPath);

    // user must be observable so the listener's reaction sees currentGroupId
    // mutations (e.g. when a fresh student is assigned to a group after boot).
    user = observable({ currentGroupId: "group-1" as string | undefined, id: fakeUser.id });

    db = {
      stores: {
        user,
        groupActivity
      },
      firebase: {
        ref: refMock,
        getGroupPath: getGroupPathMock
      }
    };
  });

  const makeSnapshot = (value: any) => ({ val: () => value, ref: usersRef });

  it("populates groupActivity store from a snapshot", async () => {
    const listener = new DBGroupActivityListener(db);
    await listener.start();

    expect(getGroupPathMock).toHaveBeenCalledWith(db.stores.user, "group-1");
    expect(refMock).toHaveBeenCalledWith(`${groupPath}/users`);
    expect(onMock).toHaveBeenCalledWith("value", expect.any(Function));
    expect(capturedHandler).toBeTruthy();

    capturedHandler!(makeSnapshot({
      "user-1": {
        activity: {
          documentKey: "doc-1",
          focus: { tileIds: ["tile-a", "tile-b"] },
          updatedAt: 1000
        }
      },
      "user-2": {
        activity: {
          documentKey: "doc-2",
          updatedAt: 2000
        }
      },
      "user-3": {
        // no activity child — should be ignored
      },
      "user-4": {
        activity: {
          // missing documentKey — should be ignored
          focus: { tileIds: ["tile-x"] },
          updatedAt: 3000
        }
      }
    }));

    expect(groupActivity.activities.size).toBe(2);
    const a1 = groupActivity.activities.get("user-1");
    expect(a1?.documentKey).toBe("doc-1");
    expect(a1?.focus?.tileIds.slice()).toEqual(["tile-a", "tile-b"]);
    expect(a1?.updatedAt).toBe(1000);
    const a2 = groupActivity.activities.get("user-2");
    expect(a2?.documentKey).toBe("doc-2");
    expect(a2?.focus).toBeUndefined();
    expect(a2?.updatedAt).toBe(2000);
  });

  it("removes a user when their activity disappears from snapshot", async () => {
    const listener = new DBGroupActivityListener(db);
    await listener.start();

    capturedHandler!(makeSnapshot({
      "user-1": {
        activity: { documentKey: "doc-1", updatedAt: 1 }
      },
      "user-2": {
        activity: { documentKey: "doc-2", updatedAt: 2 }
      }
    }));
    expect(groupActivity.activities.size).toBe(2);

    capturedHandler!(makeSnapshot({
      "user-2": {
        activity: { documentKey: "doc-2", updatedAt: 3 }
      }
    }));
    expect(groupActivity.activities.size).toBe(1);
    expect(groupActivity.activities.get("user-1")).toBeUndefined();
    expect(groupActivity.activities.get("user-2")?.updatedAt).toBe(3);
  });

  it("clears store when group changes / on stop", async () => {
    const listener = new DBGroupActivityListener(db);
    await listener.start();

    capturedHandler!(makeSnapshot({
      "user-1": {
        activity: { documentKey: "doc-1", updatedAt: 1 }
      }
    }));
    expect(groupActivity.activities.size).toBe(1);

    listener.stop();

    expect(offMock).toHaveBeenCalledWith("value", expect.any(Function));
    expect(groupActivity.activities.size).toBe(0);
  });

  it("does nothing on start when there is no current group", async () => {
    runInAction(() => { user.currentGroupId = undefined; });
    const listener = new DBGroupActivityListener(db);
    await listener.start();

    expect(refMock).not.toHaveBeenCalled();
    expect(onMock).not.toHaveBeenCalled();
  });

  it("subscribes when currentGroupId becomes set after start", async () => {
    runInAction(() => { user.currentGroupId = undefined; });
    const listener = new DBGroupActivityListener(db);
    await listener.start();
    expect(onMock).not.toHaveBeenCalled();

    runInAction(() => { user.currentGroupId = "group-1"; });

    expect(getGroupPathMock).toHaveBeenCalledWith(user, "group-1");
    expect(refMock).toHaveBeenCalledWith(`${groupPath}/users`);
    expect(onMock).toHaveBeenCalledWith("value", expect.any(Function));
  });

  it("re-subscribes when currentGroupId changes to a different group", async () => {
    const listener = new DBGroupActivityListener(db);
    await listener.start();

    capturedHandler!(makeSnapshot({ "user-1": { activity: { documentKey: "doc-1", updatedAt: 1 } } }));
    expect(groupActivity.activities.size).toBe(1);
    expect(onMock).toHaveBeenCalledTimes(1);

    runInAction(() => { user.currentGroupId = "group-2"; });

    expect(offMock).toHaveBeenCalledWith("value", expect.any(Function));
    expect(onMock).toHaveBeenCalledTimes(2);
    expect(groupActivity.activities.size).toBe(0);
  });
});
