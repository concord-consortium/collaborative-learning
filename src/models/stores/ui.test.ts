import { getSnapshot } from "mobx-state-tree";
import { UIModel, UIModelType, UIDialogModelType, userSelectTile } from "./ui";
import { PersistentUIModel, PersistentUIModelType } from "./persistent-ui/persistent-ui";
import { ProblemWorkspace, LearningLogWorkspace } from "./workspace";
import { TileModel } from "../tiles/tile-model";
import { TextContentModel } from "../tiles/text/text-content";

// This is needed so MST can deserialize snapshots referring to tools
import { registerTileTypes } from "../../register-tile-types";
registerTileTypes(["Text"]);

const mockLogTileFocusEvent = jest.fn();
jest.mock("../tiles/log/log-tile-focus-event", () => ({
  logTileFocusEvent: (...args: any[]) => mockLogTileFocusEvent(...args)
}));

function makeTile(id: string) {
  return TileModel.create({ id, content: TextContentModel.create({ text: "" }) });
}

describe("ui model", () => {
  let ui: UIModelType;
  let persistentUI: PersistentUIModelType;

  beforeEach(() => {
    ui = UIModel.create({
      learningLogWorkspace: {
        type: LearningLogWorkspace,
        mode: "1-up"
      },
    });
    persistentUI = PersistentUIModel.create({
      problemWorkspace: {
        type: ProblemWorkspace,
        mode: "1-up"
      }
    });
  });

  it("has default values", () => {
    expect(ui.error).toBe(null);
    expect(ui.showDemoCreator).toBe(false);
    expect(persistentUI.showTeacherContent).toBe(true);
    expect(ui.dialog).toBeUndefined();
  });

  it("uses override values", () => {
    ui = UIModel.create({
      showDemoCreator: true,
      error: "test",
      learningLogWorkspace: {
        type: LearningLogWorkspace,
        mode: "1-up"
      },
    });
    expect(ui.error).toBe("test");
    expect(ui.showDemoCreator).toBe(true);
  });

  it("allows error to be set", () => {
    jestSpyConsole("error", mockConsoleFn => {
      const error = "the sky is falling!";
      ui.setError(error);
      expect(ui.error).toBe(error);
      expect(mockConsoleFn).toHaveBeenCalled();
    });
    ui.clearError();
    expect(ui.error).toBe(null);
  });

  it("allows demo creator to be shown", () => {
    expect(ui.showDemoCreator).toBe(false);
    ui.setShowDemoCreator(true);
    expect(ui.showDemoCreator).toBe(true);
  });

  it("allows selected tile to be set", () => {
    expect(ui.selectedTileIds).toStrictEqual([]);
    const content = TextContentModel.create({text: "test"});
    const tile = TileModel.create({
      id: "1",
      content
    });
    ui.setSelectedTile(tile);
    expect(ui.selectedTileIds).toStrictEqual(["1"]);
    expect(ui.isSelectedTile(tile)).toBe(true);
    ui.setSelectedTile();
    expect(ui.selectedTileIds).toStrictEqual([]);
    expect(ui.isSelectedTile(tile)).toBe(false);
  });

  it("logs SELECT_TILE once when a tile newly enters the selection, not on re-select/deselect", () => {
    // Every mouse/keyboard/drag selection path funnels through setSelectedTile /
    // setSelectedTileId, so this choke-point covers all of them.
    mockLogTileFocusEvent.mockReset();
    const tileA = makeTile("A");

    ui.setSelectedTile(tileA);                 // new → log A (editable)
    expect(mockLogTileFocusEvent).toHaveBeenCalledTimes(1);
    expect(mockLogTileFocusEvent).toHaveBeenLastCalledWith("A", false);

    ui.setSelectedTile(tileA);                 // already selected → no log
    expect(mockLogTileFocusEvent).toHaveBeenCalledTimes(1);

    ui.setSelectedTileId("B");                 // the mouse-click setter → new → log B
    expect(mockLogTileFocusEvent).toHaveBeenCalledTimes(2);
    expect(mockLogTileFocusEvent).toHaveBeenLastCalledWith("B", false);

    ui.setSelectedTile(tileA, { append: true }); // shift-click adds A back → log A
    expect(mockLogTileFocusEvent).toHaveBeenCalledTimes(3);

    ui.setSelectedTile(tileA, { append: true }); // shift-click again deselects A → no log
    expect(mockLogTileFocusEvent).toHaveBeenCalledTimes(3);

    ui.setSelectedTile();                       // clear → no log
    expect(mockLogTileFocusEvent).toHaveBeenCalledTimes(3);
  });

  it("does not log a shift-click that deselects a tile other than the last one logged", () => {
    // The re-select/deselect case above deselects the tile it just logged, so lastLoggedTileId
    // already suppresses it. Deselecting a *different* tile is what isolates the isDeselecting
    // guard: without it, removing A from the selection would log A as though it were focused.
    mockLogTileFocusEvent.mockReset();
    const tileA = makeTile("A");
    const tileB = makeTile("B");

    ui.setSelectedTile(tileA);                   // new → log A
    ui.setSelectedTile(tileB, { append: true }); // shift-click adds B → log B
    expect(mockLogTileFocusEvent).toHaveBeenCalledTimes(2);

    ui.setSelectedTile(tileA, { append: true }); // shift-click removes A → not a focus event
    expect(ui.selectedTileIds).toStrictEqual(["B"]);
    expect(mockLogTileFocusEvent).toHaveBeenCalledTimes(2);
  });

  it("logs a tile again after select-all, which leaves no single tile focused", () => {
    mockLogTileFocusEvent.mockReset();
    const tileA = makeTile("A");

    ui.setSelectedTile(tileA);              // new → log A
    expect(mockLogTileFocusEvent).toHaveBeenCalledTimes(1);

    ui.selectAllTiles(["A", "B"]);          // select-all doesn't focus any one tile
    expect(mockLogTileFocusEvent).toHaveBeenCalledTimes(1);

    ui.setSelectedTile(tileA);              // collapsing back onto A is a new focus → log A
    expect(ui.selectedTileIds).toStrictEqual(["A"]);
    expect(mockLogTileFocusEvent).toHaveBeenCalledTimes(2);
  });

  it("flags read-only selections (resources panel / class work) in the SELECT_TILE event", () => {
    mockLogTileFocusEvent.mockReset();
    const tile = makeTile("R");
    ui.setSelectedTile(tile, { append: false, readOnly: true });
    expect(mockLogTileFocusEvent).toHaveBeenCalledTimes(1);
    expect(mockLogTileFocusEvent).toHaveBeenLastCalledWith("R", true);
  });

  it("does not log selections made on the user's behalf (read-aloud, tile creation, chat)", () => {
    mockLogTileFocusEvent.mockReset();

    ui.setSelectedTileId("P", { programmatic: true });
    expect(ui.selectedTileIds).toStrictEqual(["P"]);   // still selects
    expect(mockLogTileFocusEvent).not.toHaveBeenCalled();

    ui.setSelectedTile(makeTile("Q"), { programmatic: true });
    expect(mockLogTileFocusEvent).not.toHaveBeenCalled();
  });

  it("logs the tile the user acted on, not the container a read-only selection resolves to", () => {
    mockLogTileFocusEvent.mockReset();
    userSelectTile.cancel();  // module-level 50ms leading-edge debounce, shared across tests
    const container = makeTile("container-1");
    const nested = makeTile("nested-1");

    userSelectTile(ui, nested, { readOnly: true, container });

    // The container is what gets selected, but the nested tile is what the user viewed.
    expect(ui.selectedTileIds).toStrictEqual(["container-1"]);
    expect(mockLogTileFocusEvent).toHaveBeenCalledTimes(1);
    expect(mockLogTileFocusEvent).toHaveBeenLastCalledWith("nested-1", true);
  });

  it("logs each read-only sibling viewed inside the same container", () => {
    mockLogTileFocusEvent.mockReset();
    userSelectTile.cancel();
    const container = makeTile("container-2");
    const first = makeTile("nested-a");
    const second = makeTile("nested-b");

    userSelectTile(ui, first, { readOnly: true, container });
    expect(mockLogTileFocusEvent).toHaveBeenLastCalledWith("nested-a", true);

    // The container is already selected, so only the last-logged tile can tell these apart.
    userSelectTile.cancel();
    userSelectTile(ui, second, { readOnly: true, container });
    expect(mockLogTileFocusEvent).toHaveBeenCalledTimes(2);
    expect(mockLogTileFocusEvent).toHaveBeenLastCalledWith("nested-b", true);

    // Re-viewing the tile already reported is not a new focus.
    userSelectTile.cancel();
    userSelectTile(ui, second, { readOnly: true, container });
    expect(mockLogTileFocusEvent).toHaveBeenCalledTimes(2);
  });

  it("logs a drag-initiated selection once, when the dragged tile newly enters the selection", () => {
    mockLogTileFocusEvent.mockReset();
    const tile = makeTile("D");

    ui.setSelectedTile(tile, { dragging: true });
    expect(ui.selectedTileIds).toContain("D");
    expect(mockLogTileFocusEvent).toHaveBeenCalledTimes(1);
    expect(mockLogTileFocusEvent).toHaveBeenLastCalledWith("D", false);

    ui.setSelectedTile(tile, { dragging: true });  // already selected → no new log
    expect(mockLogTileFocusEvent).toHaveBeenCalledTimes(1);
  });

  it("keeps the selection when logging throws", () => {
    mockLogTileFocusEvent.mockReset();
    mockLogTileFocusEvent.mockImplementationOnce(() => { throw new Error("logging blew up"); });
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);

    expect(() => ui.setSelectedTileId("T")).not.toThrow();
    expect(ui.selectedTileIds).toStrictEqual(["T"]);
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it("allows divider position to be set", () => {
    expect(persistentUI.navTabContentShown).toBe(true);
    expect(persistentUI.workspaceShown).toBe(true);
    persistentUI.setDividerPosition(0);
    expect(persistentUI.navTabContentShown).toBe(false);
    expect(persistentUI.workspaceShown).toBe(true);
  });

  it("allows alert dialogs", () => {
    expect(ui.dialog).toBe(undefined);
    ui.alert("alert test");
    let dialog = ui.dialog as UIDialogModelType;
    expect(ui.dialog).not.toBe(undefined);
    expect(dialog.type).toBe("alert");
    expect(dialog.text).toBe("alert test");
    expect(dialog.title).toBe(undefined);

    ui.alert("alert test", "Test Alert Title");
    dialog = ui.dialog as UIDialogModelType;
    expect(dialog.title).toBe("Test Alert Title");
  });

  it("allows confirm dialogs", () => {
    expect(ui.dialog).toBe(undefined);
    ui.confirm("confirm test");
    let dialog = ui.dialog as UIDialogModelType;
    expect(ui.dialog).not.toBe(undefined);
    expect(dialog.type).toBe("confirm");
    expect(dialog.text).toBe("confirm test");
    expect(dialog.title).toBe(undefined);

    ui.confirm("confirm test", "Test Confirm Title");
    dialog = ui.dialog as UIDialogModelType;
    expect(dialog.title).toBe("Test Confirm Title");
    ui.closeDialog();
  });

  it("allows tile to be picked up and cleared", () => {
    expect(ui.pickedUpTileId).toBeUndefined();
    expect(ui.pickedUpDocId).toBeUndefined();
    expect(ui.isTilePickedUp).toBe(false);

    ui.pickUpTile("tile-1", "doc-1");
    expect(ui.pickedUpTileId).toBe("tile-1");
    expect(ui.pickedUpDocId).toBe("doc-1");
    expect(ui.isTilePickedUp).toBe(true);

    ui.clearPickedUpTile();
    expect(ui.pickedUpTileId).toBeUndefined();
    expect(ui.pickedUpDocId).toBeUndefined();
    expect(ui.isTilePickedUp).toBe(false);
  });

  it("allows picking up a different tile replaces the previous", () => {
    ui.pickUpTile("tile-1", "doc-1");
    expect(ui.pickedUpTileId).toBe("tile-1");

    ui.pickUpTile("tile-2", "doc-2");
    expect(ui.pickedUpTileId).toBe("tile-2");
    expect(ui.pickedUpDocId).toBe("doc-2");
  });

  it("pickUpTile stores optional type and position", () => {
    ui.pickUpTile("t1", "d1", "Text", 100, 200);
    expect(ui.pickedUpTileType).toBe("Text");
    expect(ui.pickedUpX).toBe(100);
    expect(ui.pickedUpY).toBe(200);
  });

  it("clearPickedUpTile resets type and position", () => {
    ui.pickUpTile("t1", "d1", "Text", 100, 200);
    ui.clearPickedUpTile();
    expect(ui.pickedUpTileType).toBeUndefined();
    expect(ui.pickedUpX).toBeUndefined();
    expect(ui.pickedUpY).toBeUndefined();
  });

  it("setFocusedDropZoneIndex sets and clears", () => {
    ui.setFocusedDropZoneIndex(3);
    expect(ui.focusedDropZoneIndex).toBe(3);
    ui.setFocusedDropZoneIndex(undefined);
    expect(ui.focusedDropZoneIndex).toBeUndefined();
  });

  it("clearPickedUpTile also clears focusedDropZoneIndex", () => {
    ui.pickUpTile("t1", "d1");
    ui.setFocusedDropZoneIndex(2);
    ui.clearPickedUpTile();
    expect(ui.focusedDropZoneIndex).toBeUndefined();
  });

  it("clearPickedUpTile clears drop zone position", () => {
    ui.pickUpTile("t1", "d1", "Text", 100, 200);
    ui.setFocusedDropZonePosition(500, 300);
    expect(ui.focusedDropZoneX).toBe(500);
    expect(ui.focusedDropZoneY).toBe(300);

    ui.clearPickedUpTile();
    expect(ui.focusedDropZoneX).toBeUndefined();
    expect(ui.focusedDropZoneY).toBeUndefined();
  });

  it("pick-up state appears in snapshots as MST properties", () => {
    ui.pickUpTile("t1", "d1", "Text", 100, 200);
    const snapshot = getSnapshot(ui);
    expect(snapshot).toHaveProperty("pickedUpTileId", "t1");
    expect(snapshot).toHaveProperty("pickedUpDocId", "d1");
    expect(snapshot).toHaveProperty("pickedUpTileType", "Text");
    expect(snapshot).toHaveProperty("pickedUpX", 100);
    expect(snapshot).toHaveProperty("pickedUpY", 200);
  });

  it("allows prompt dialogs", () => {
    expect(ui.dialog).toBe(undefined);
    ui.prompt("prompt test");
    expect(ui.dialog).not.toBe(undefined);
    let dialog = ui.dialog as UIDialogModelType;
    expect(dialog.type).toBe("prompt");
    expect(dialog.text).toBe("prompt test");
    expect(dialog.defaultValue).toBe("");
    expect(dialog.title).toBe(undefined);
    ui.closeDialog();

    ui.prompt("prompt test", "default value");
    dialog = ui.dialog as UIDialogModelType;
    expect(dialog.defaultValue).toBe("default value");
    expect(dialog.title).toBe(undefined);

    ui.prompt("prompt test", undefined, "Test Prompt Title");
    dialog = ui.dialog as UIDialogModelType;
    expect(dialog.title).toBe("Test Prompt Title");
  });
});
