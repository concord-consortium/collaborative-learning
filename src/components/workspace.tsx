import { inject, observer } from "mobx-react";
import * as React from "react";

import { WorkspaceTool,
         WorkspaceModelType,
         LearningLogWorkspaceModelType,
         SectionWorkspaceModelType
       } from "../models/workspaces";
import { SupportItemModelType } from "../models/supports";
import { CanvasComponent } from "./canvas";
import { FourUpComponent } from "./four-up";
import { BaseComponent, IBaseProps } from "./base";
import { kSectionID, kLearningLogID, kPublicationID } from "../models/workspaces";

import "./workspace.sass";

export type WorkspaceSide = "primary" | "comparison";

interface IProps extends IBaseProps {
  workspace: WorkspaceModelType;
  side: WorkspaceSide;
  readOnly?: boolean;
}

@inject("stores")
@observer
export class WorkspaceComponent extends BaseComponent<IProps, {}> {

  public render() {
    return (
      <div className="workspace">
        {this.renderTitleBar()}
        {this.isPrimary() ? this.renderToolbar() : null}
        {this.renderCanvas()}
        {this.renderStatusBar()}
      </div>
    );
  }

  private renderTitleBar() {
    const { workspace } = this.props;
    if (workspace.type === kSectionID) {
      return this.renderSectionTitleBar();
    }
    if (workspace.type === kLearningLogID) {
      return this.renderLearningLogTitleBar();
    }
    if (workspace.type === kPublicationID) {
      return this.renderSectionTitleBar(true);
    }
  }

  private renderSectionTitleBar(hideButtons?: boolean) {
    const {ui, problem} = this.stores;
    const workspace = this.sectionWorkspace;
    const activeSection = problem.getSectionById(workspace.sectionId);
    const show4up = !ui.comparisonWorkspaceVisible && !ui.bottomNavExpanded;
    const share = workspace.visibility === "private" ? "share" : "unshare";
    return (
      <div className="titlebar">
        <div className="title">{activeSection ? `Section: ${activeSection.title}` : "Section"}</div>
        {!hideButtons &&
          <div className="actions">
            <svg className={`icon icon-publish`} onClick={this.handlePublishWorkspace}>
              <use xlinkHref={`#icon-publish`} />
            </svg>
            <svg className={`icon icon-${share}`} onClick={this.handleToggleVisibility}>
              <use xlinkHref={`#icon-${share}`} />
            </svg>
            {show4up ? this.renderMode() : null}
          </div>
        }
      </div>
    );
  }

  private renderMode() {
    const workspace = this.sectionWorkspace;
    const mode = workspace.mode === "1-up" ? "up1" : "up";
    return (
      <svg className={`icon icon-${mode}`} onClick={this.handleToggleWorkspaceMode}>
        <use xlinkHref={`#icon-${mode}`} />
      </svg>
    );
  }

  private renderLearningLogTitleBar() {
    const workspace = this.learningLogWorkspace;
    return (
      <div className="titlebar">
        <div className="title">Learning Log: {workspace.title}</div>
        <div className="actions" />
      </div>
    );
  }

  private renderToolbar() {
    const workspace = this.props.workspace;
    if (!workspace.tool) {
      return;
    }
    const className = (tool: WorkspaceTool) => {
      return `tool ${tool}${tool === workspace.tool ? " active" : ""}`;
    };
    const handleSelectTool = (tool: WorkspaceTool) => {
      const { ui } = this.stores;
      return (e: React.MouseEvent<HTMLDivElement>) => {
        switch (tool) {
          case "delete":
            if (ui.selectedTileId) {
              workspace.deleteTile(ui.selectedTileId);
            }
            break;
          default:
            workspace.selectTool(tool);
        }
      };
    };
    return (
      <div className="toolbar">
        <div className={className("select")} title="Select" onClick={handleSelectTool("select")}>↖</div>
        <div className={className("text")} title="Text" onClick={handleSelectTool("text")}>T</div>
        <div className={className("geometry")} title="Geometry" onClick={handleSelectTool("geometry")}/>
        <div className={className("delete")} title="Delete" onClick={handleSelectTool("delete")}>{"\u274c"}</div>
      </div>
    );
  }

  private renderCanvas() {
    const { workspace } = this.props;
    if (workspace.type === kSectionID) {
      return (
        <div className="canvas-area">
          {this.sectionWorkspace.mode === "1-up" ? this.render1UpCanvas() : this.render4UpCanvas()}
        </div>
      );
    }
    if (workspace.type === kLearningLogID) {
      return (
        <div className="canvas-area learning-log-canvas-area">
          {this.render1UpCanvas()}
        </div>
      );
    }
    if (workspace.type === kPublicationID) {
      return (
        <div className="canvas-area learning-log-canvas-area">
          {this.render1UpCanvas(true)}
        </div>
      );
    }
  }

  private render1UpCanvas(forceReadOnly?: boolean) {
    const readOnly = forceReadOnly ? true : this.props.readOnly;
    return (
      <CanvasComponent context="1-up" document={this.props.workspace.document} readOnly={readOnly} />
    );
  }

  private render4UpCanvas() {
    return (
      <FourUpComponent workspace={this.sectionWorkspace} />
    );
  }

  private renderStatusBar() {
    const {workspace} = this.props;
    const isPrimary = this.isPrimary();
    const showContents = isPrimary && (workspace.type === kSectionID);
    return (
      <div className="statusbar">
        <div className="supports">
          {showContents ? this.renderSupportIcons() : null}
          {showContents ? this.renderVisibleSupports() : null}
        </div>
        <div className="actions">
          {isPrimary ? this.renderTwoUpButton() : null}
        </div>
      </div>
    );
  }

  private renderTwoUpButton() {
    const {ui} = this.stores;
    const mode = ui.comparisonWorkspaceVisible ? "up" : "up2";
    const llMode = ui.llComparisonWorkspaceVisible ? "up" : "up2";

    if (this.props.workspace.type === kLearningLogID) {
      return (
        <svg className={`icon icon-${llMode}`} onClick={this.handleToggleLLTwoUp}>
          <use xlinkHref={`#icon-${llMode}`} />
        </svg>
      );
    }
    else if (this.props.workspace.mode === "1-up") {
      return (
        <svg className={`icon icon-${mode}`} onClick={this.handleToggleTwoUp}>
          <use xlinkHref={`#icon-${mode}`} />
        </svg>
      );
    }
  }

  private renderSupportIcons() {
    const supports = this.getSupportsWithIndices();
    return (
      <div className="supports-list">
        {supports.map((support) => {
          return (
            <span
              key={support.index}
              onClick={this.handleToggleSupport(support.item)}
              className={support.item.visible ? "active" : undefined}
            >
              {support.index}
            </span>
          );
        })}
      </div>
    );
  }

  private renderVisibleSupports() {
    const supports = this.getSupportsWithIndices().filter((supportWithIndex) => supportWithIndex.item.visible);
    if (supports.length === 0) {
      return null;
    }
    return (
      <div className="visible-supports">
        <div className="supports-list">
          {supports.map((support) => {
            return (
              <div key={support.index} onClick={this.handleToggleSupport(support.item)}>
                <span>{support.index}</span> {support.item.text}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  private handleToggleWorkspaceMode = () => {
    this.sectionWorkspace.toggleMode();
  }

  private handleToggleVisibility = () => {
    this.sectionWorkspace.toggleVisibility();
  }

  private handleToggleSupport = (support: SupportItemModelType) => {
    return () => this.stores.supports.toggleSupport(support);
  }

  private handleToggleTwoUp = () => {
    this.stores.ui.toggleComparisonWorkspaceVisible();
  }

  private handleToggleLLTwoUp = () => {
    this.stores.ui.toggleLLComparisonWorkspaceVisible();
  }

  private handlePublishWorkspace = () => {
    const { db } = this.stores;
    // TODO: Disable publish button while publishing
    db.publishWorkspace(this.sectionWorkspace)
      .then(() => alert("Published"));
  }

  private getSupportsWithIndices() {
    return this.stores.supports.getAllForSection(this.sectionWorkspace.sectionId).map((support, index) => {
      return {index: index + 1, item: support};
    });
  }

  private get sectionWorkspace() {
    return this.props.workspace as SectionWorkspaceModelType;
  }

  private get learningLogWorkspace() {
    return this.props.workspace as LearningLogWorkspaceModelType;
  }

  private isPrimary() {
    return this.props.side === "primary";
  }

}
