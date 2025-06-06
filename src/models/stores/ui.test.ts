import { UIModel, UIModelType, UIDialogModelType } from "./ui";
import { PersistentUIModel, PersistentUIModelType } from "./persistent-ui/persistent-ui";
import { ProblemWorkspace, LearningLogWorkspace } from "./workspace";
import { TileModel } from "../tiles/tile-model";
import { TextContentModel } from "../tiles/text/text-content";

// This is needed so MST can deserialize snapshots referring to tools
import { registerTileTypes } from "../../register-tile-types";
registerTileTypes(["Text"]);

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
