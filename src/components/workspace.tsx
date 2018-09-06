import { inject, observer } from "mobx-react";
import * as React from "react";

import { WorkspaceModel, WorkspaceTool } from "../models/workspace";
import { CanvasComponent } from "./canvas";
import { FourUpComponent } from "./four-up";
import { BaseComponent, IBaseProps } from "./base";

import "./workspace.sass";

// TODO: integrate the workspace model into a larger document store
//       for now just have a singleton
const workspace = WorkspaceModel.create({
  mode: "1-up",
  tool: "select",
});

interface IProps extends IBaseProps {}

@inject("stores")
@observer
export class WorkspaceComponent extends BaseComponent<IProps, {}> {

  public render() {
    return (
      <div className="workspace">
        {this.renderTitleBar()}
        {this.renderToolbar()}
        <div className="canvas-area">
          {workspace.mode === "1-up" ? this.render1UpCanvas() : this.render4UpCanvas()}
        </div>
        {this.renderSupports()}
      </div>
    );
  }

  private renderTitleBar() {
    const { ui, problem } = this.stores;
    const activeSection = problem.getSectionByIndex(ui.activeSectionIndex);
    return (
      <div className="titlebar">
        <div className="title">{activeSection ? activeSection.title : ""}</div>
        <div className="actions">
          <span onClick={this.handleToggleWorkspaceMode}>{workspace.mode === "1-up" ? "4-up" : "1-up"}</span>
        </div>
      </div>
    );
  }

  private renderToolbar() {
    const className = (tool: WorkspaceTool) => {
      return `tool${tool === workspace.tool ? " active" : ""}`;
    };
    const handleSelectTool = (tool: WorkspaceTool) => {
      return (e: React.MouseEvent<HTMLDivElement>) => {
        workspace.toggleTool(tool);
      };
    };
    return (
      <div className="toolbar">
        <div className={className("select")} title="Select" onClick={handleSelectTool("select")}>↖</div>
        <div className={className("text")} title="Text" onClick={handleSelectTool("text")}>T</div>
      </div>
    );
  }

  private render1UpCanvas() {
    return (
      <CanvasComponent />
    );
  }

  private render4UpCanvas() {
    return (
      <FourUpComponent />
    );
  }

  private renderSupports() {
    return (
      <div className="supports">
        <span>TBD: Just In Time Supports</span>
      </div>
    );
  }

  private handleToggleWorkspaceMode = () => {
    workspace.toggleMode();
  }

}
