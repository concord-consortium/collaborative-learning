import { assert, expect } from "chai";
import { getSnapshot } from "mobx-state-tree";
import { WorkspaceModel, WorkspaceModelType } from "./workspace";

describe("workspace model", () => {
  let workspace: WorkspaceModelType;

  before(() => {
    workspace = WorkspaceModel.create({
      mode: "1-up",
      tool: "select",
    });
  });

  it("has default values", () => {
    expect(workspace.mode).to.equal("1-up");
    expect(workspace.tool).to.equal("select");
  });

  it("allows the mode to be toggled", () => {
    workspace.toggleMode();
    expect(workspace.mode).to.equal("4-up");
    workspace.toggleMode();
    expect(workspace.mode).to.equal("1-up");
  });

  it("allows the mode to be explicitly set", () => {
    workspace.toggleMode("1-up");
    expect(workspace.mode).to.equal("1-up");
    workspace.toggleMode("4-up");
    expect(workspace.mode).to.equal("4-up");
  });

  it("allows the select tool to be toggled", () => {
    workspace.toggleTool("select");
    expect(workspace.tool).to.equal("select");
    workspace.toggleTool("select");
    expect(workspace.tool).to.equal("select");
  });

  it("allows the text tool to be toggled", () => {
    workspace.toggleTool("text");
    expect(workspace.tool).to.equal("text");
    workspace.toggleTool("text");
    expect(workspace.tool).to.equal("select");
  });
});
