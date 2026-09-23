import { DocumentWorkspaceComponent } from "./document-workspace";
import { CanonicalSlotOwnerChangedError } from "../../lib/scoped-document-pointers";

// The component reads everything through `this.props.stores`, so the File ▸ Group Doc handler can be
// exercised on a bare instance. Only the three collaborators it touches are stubbed.
const buildStores = (getOrCreateGroupDocument: jest.Mock) => ({
  db: { getOrCreateGroupDocument },
  persistentUI: { problemWorkspace: { setPrimaryDocument: jest.fn() } },
  ui: { setError: jest.fn() }
});

// `inject` wraps the class, so the component itself is reached through `wrappedComponent`.
const WrappedComponent: any = (DocumentWorkspaceComponent as any).wrappedComponent ?? DocumentWorkspaceComponent;

const openGroupDocument = (stores: any) => {
  const component: any = new WrappedComponent({ stores });
  return component.handleOpenGroupDocument();
};

describe("DocumentWorkspaceComponent File ▸ Group Doc", () => {
  it("opens the group document", async () => {
    const groupDoc = { key: "group-doc" };
    const stores = buildStores(jest.fn().mockResolvedValue(groupDoc));
    await openGroupDocument(stores);
    expect(stores.persistentUI.problemWorkspace.setPrimaryDocument).toHaveBeenCalledWith(groupDoc);
    expect(stores.ui.setError).not.toHaveBeenCalled();
  });

  // Nothing else opens a group document when the unit does not start students in one, so abandoning the
  // click would leave the user on their old document with no explanation.
  it("retries for the new group when membership moved during the click", async () => {
    const newGroupDoc = { key: "new-group-doc" };
    const getOrCreate = jest.fn()
      .mockRejectedValueOnce(new CanonicalSlotOwnerChangedError("slots/a", "slots/b"))
      .mockResolvedValueOnce(newGroupDoc);
    const stores = buildStores(getOrCreate);
    await openGroupDocument(stores);
    expect(getOrCreate).toHaveBeenCalledTimes(2);
    expect(stores.persistentUI.problemWorkspace.setPrimaryDocument).toHaveBeenCalledWith(newGroupDoc);
    expect(stores.ui.setError).not.toHaveBeenCalled();
  });

  it("gives up rather than spinning when membership keeps moving", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const getOrCreate = jest.fn()
      .mockRejectedValue(new CanonicalSlotOwnerChangedError("slots/a", "slots/b"));
    const stores = buildStores(getOrCreate);
    await openGroupDocument(stores);
    expect(getOrCreate.mock.calls.length).toBeLessThanOrEqual(3);
    expect(stores.persistentUI.problemWorkspace.setPrimaryDocument).not.toHaveBeenCalled();
    // Leaves a trace for a developer without putting a race in front of the student.
    expect(warnSpy).toHaveBeenCalled();
    expect(stores.ui.setError).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("reports a failure that is not a group change", async () => {
    const failure = new Error("firestore unavailable");
    const stores = buildStores(jest.fn().mockRejectedValue(failure));
    await openGroupDocument(stores);
    expect(stores.ui.setError).toHaveBeenCalledWith(failure);
    expect(stores.persistentUI.problemWorkspace.setPrimaryDocument).not.toHaveBeenCalled();
  });
});
