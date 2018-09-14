import { inject, observer } from "mobx-react";
import * as React from "react";

import "./learning-log.sass";
import { TabComponent } from "./tab";
import { TabSetComponent } from "./tab-set";
import { BaseComponent, IBaseProps } from "./base";
import { CanvasComponent } from "./canvas";
import { LearningLogWorkspaceModelType } from "../models/workspaces";
import { timeAgo, niceDateTime } from "../utilities/time";

interface IProps extends IBaseProps {}

@inject("stores")
@observer
export class LearningLogComponent extends BaseComponent<IProps, {}> {

  public render() {
    return (
      <div className="learning-log">
        <button onClick={this.handleCreateLearningLog}>Create</button>
        {this.renderLearningLogs()}
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
                  <CanvasComponent document={learningLog.document} readOnly={true} />
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
    ui.setAvailableWorkspace(learningLog);
    ui.contractAll();
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

  private getSortedLearningLogs() {
    return this.stores.workspaces.learningLogs.slice().sort((a, b) => b.createdAt - a.createdAt);
  }
}
