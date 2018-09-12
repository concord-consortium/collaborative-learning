import { inject, observer } from "mobx-react";
import * as React from "react";

import { WorkspaceModel, WorkspaceTool, WorkspaceModelType } from "../models/workspaces";
import { CanvasComponent } from "./canvas";
import { FourUpComponent } from "./four-up";
import { BaseComponent, IBaseProps } from "./base";

import "./workspace.sass";

interface IProps extends IBaseProps {
  workspace: WorkspaceModelType;
}

@inject("stores")
@observer
export class WorkspaceComponent extends BaseComponent<IProps, {}> {

  public render() {
    return (
      <div className="workspace">
        {this.renderTitleBar()}
        {this.renderToolbar()}
        <div className="canvas-area">
          {this.props.workspace.mode === "1-up" ? this.render1UpCanvas() : this.render4UpCanvas()}
        </div>
        {this.renderSupports()}
      </div>
    );
  }

  private renderTitleBar() {
    const { workspace } = this.props;
    const activeSection = this.stores.problem.getSectionById(workspace.sectionId);
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
    const { workspace } = this.props;
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
      <CanvasComponent document={this.props.workspace.userDocument} />
    );
  }

  private render4UpCanvas() {
    return (
      <FourUpComponent workspace={this.props.workspace} />
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
    this.props.workspace.toggleMode();
  }

}
