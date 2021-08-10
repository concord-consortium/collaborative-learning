import { UIModel, UIModelType, UIDialogModelType } from "./ui";
import { ProblemWorkspace, LearningLogWorkspace } from "./workspace";
import { ToolTileModel } from "../tools/tool-tile";

describe("ui model", () => {
  let ui: UIModelType;

  beforeEach(() => {
    ui = UIModel.create({
      problemWorkspace: {
        type: ProblemWorkspace,
        mode: "1-up"
      },
      learningLogWorkspace: {
        type: LearningLogWorkspace,
        mode: "1-up"
      },
    });
  });

  it("has default values", () => {
    expect(ui.error).toBe(null);
    expect(ui.showDemoCreator).toBe(false);
    expect(ui.dialog).toBe(undefined);
  });

  it("uses override values", () => {
    ui = UIModel.create({
      showDemoCreator: true,
      error: "test",
      problemWorkspace: {
        type: ProblemWorkspace,
        mode: "1-up"
      },
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
    ui.setSelectedTile(ToolTileModel.create({
      id: "1",
      content: {
        type: "Text",
        text: "test"
      }
    }));
    expect(ui.selectedTileIds).toStrictEqual(["1"]);
    ui.setSelectedTile();
    expect(ui.selectedTileIds).toStrictEqual([]);
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

  it("allows comfirm dialogs", () => {
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

    ui.prompt("prompt test", "default value");
    dialog = ui.dialog as UIDialogModelType;
    expect(dialog.defaultValue).toBe("default value");
    expect(dialog.title).toBe(undefined);

    ui.prompt("prompt test", undefined, "Test Prompt Title");
    dialog = ui.dialog as UIDialogModelType;
    expect(dialog.title).toBe("Test Prompt Title");
  });
});
