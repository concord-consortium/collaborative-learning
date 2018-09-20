import { inject, observer } from "mobx-react";
import * as React from "react";

import "./learning-log.sass";

import { BaseComponent, IBaseProps } from "./base";
import { CanvasComponent } from "./canvas";
import { LearningLogWorkspaceModelType } from "../models/workspaces";
import { timeAgo, niceDateTime } from "../utilities/time";
import { WorkspaceComponent, WorkspaceSide } from "./workspace";

interface IProps extends IBaseProps {}

@inject("stores")
@observer
export class LearningLogComponent extends BaseComponent<IProps, {}> {

  public render() {
    return (
      <div className="learning-log">
        {this.renderWorkspaces()}
        <div className="logs">
          <button onClick={this.handleCreateLearningLog}>Create</button>
          {this.renderLearningLogs()}
        </div>
      </div>
    );
  }

  private renderWorkspaces() {
    const {ui, workspaces} = this.stores;
    const primaryWorkspace = ui.llPrimaryWorkspaceDocumentKey
                        ? workspaces.getWorkspace(ui.llPrimaryWorkspaceDocumentKey)
                        : null;
    const comparisonWorkspace = ui.llComparisonWorkspaceDocumentKey
                        ? workspaces.getWorkspace(ui.llComparisonWorkspaceDocumentKey)
                        : null;

    if (!primaryWorkspace) {
      return (
        <div className="workspaces">
          {this.renderWorkspace("single-workspace", "primary")}
        </div>
      );
    }

    if (ui.llComparisonWorkspaceVisible) {
      return (
        <div className="workspaces">
          {this.renderWorkspace(
              "left-workspace",
              "primary",
              <WorkspaceComponent workspace={primaryWorkspace} side="primary" />
          )}
          {this.renderWorkspace("right-workspace", "comparison", comparisonWorkspace
              ? <WorkspaceComponent workspace={comparisonWorkspace} readOnly={true} side="comparison" />
              : this.renderComparisonPlaceholder())}
        </div>
      );
    }
    else {
      return (
        <div className="workspaces">
          {this.renderWorkspace(
              "single-workspace",
              "primary",
              <WorkspaceComponent workspace={primaryWorkspace} side="primary"/>
          )}
        </div>
      );
    }
  }

  private renderWorkspace(className: string, side: WorkspaceSide, child?: JSX.Element) {
    return (
      <div
        onMouseOver={this.handleContractRightNav}
        className={className}
        onDragOver={this.handleDragOver}
        onDrop={this.handleDrop(side)}
      >
        {child}
      </div>
    );
  }

  private renderComparisonPlaceholder() {
    return (
      <div className="comparison-placeholder">
        Click an item in the right or bottom tabs to show it here
      </div>
    );
  }

  private renderLearningLogs() {
    const learningLogs = this.getSortedLearningLogs();
    if (learningLogs.length === 0) {
      return null;
    }
    return (
      <div className="list">
        {learningLogs.map((learningLog) => {
          return (
            <div
              className="list-item"
              key={learningLog.document.key}
            >
              <div
                className="scaled-list-item-container"
                onClick={this.handleLearningLogClicked(learningLog)}
                onDragStart={this.handleLearningLogDragStart(learningLog)}
                draggable={true}
              >
                <div className="scaled-list-item">
                  <CanvasComponent document={learningLog.document} readOnly={true} context="learning-log" />
                </div>
              </div>
              <div className="info">
                <span onClick={this.handleRenameLearningLog(learningLog)}>{learningLog.title}</span>
                <div className="created" title={niceDateTime(learningLog.createdAt)}>
                  {timeAgo(learningLog.createdAt)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  private handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer.getData("workspace.document.key")) {
      e.preventDefault();
    }
  }

  private handleDrop = (side: WorkspaceSide) => {
    return (e: React.DragEvent<HTMLDivElement>) => {
      const {ui, workspaces} = this.stores;
      const documentKey = e.dataTransfer.getData("workspace.document.key");
      const workspace = documentKey ? workspaces.getWorkspace(documentKey) : null;
      if (workspace) {
        if (side === "primary") {
          if (workspace.type === "learningLog") {
            ui.setLLPrimaryWorkspace(workspace);
          }
          else {
            alert("Sorry, you can't drop that type of document here.");
          }
        }
        else {
          ui.setLLComparisonWorkspace(workspace);
        }
      }
    };
  }

  private handleCreateLearningLog = () => {
    const title = (prompt("Enter name of learning log") || "").trim();
    if (title.length > 0) {
      this.stores.db.createLearningLogWorkspace(title)
        .then(this.handleSelectLearningLog)
        .catch(this.stores.ui.setError);
    }
  }

  private handleLearningLogClicked = (learningLog: LearningLogWorkspaceModelType) => {
    return (e: React.MouseEvent<HTMLDivElement>) => {
      this.handleSelectLearningLog(learningLog);
    };
  }

  private handleSelectLearningLog = (learningLog: LearningLogWorkspaceModelType) => {
    const {ui} = this.stores;
    ui.setAvailableLLWorkspace(learningLog);
  }

  private handleLearningLogDragStart = (workspace: LearningLogWorkspaceModelType) => {
    return (e: React.DragEvent<HTMLDivElement>) => {
      e.dataTransfer.setData("workspace.document.key", workspace.document.key);
    };
  }

  private handleRenameLearningLog = (learningLog: LearningLogWorkspaceModelType) => {
    const {ui} = this.stores;
    return (e: React.MouseEvent<HTMLSpanElement>) => {
      const title = (prompt("Enter new name of learning log", learningLog.title) || "").trim();
      if ((title.length > 0) && (title !== learningLog.title)) {
        learningLog.setTitle(title);
      }
    };
  }

  private handleContractRightNav = (e: React.DragEvent<HTMLDivElement>) => {
    this.stores.ui.toggleRightNav(false);
  }

  private getSortedLearningLogs() {
    return this.stores.workspaces.learningLogs.slice().sort((a, b) => b.createdAt - a.createdAt);
  }
}
