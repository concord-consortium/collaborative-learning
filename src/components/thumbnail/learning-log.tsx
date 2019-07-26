import { inject, observer } from "mobx-react";
import { getSnapshot } from "mobx-state-tree";
import * as React from "react";

import { BaseComponent, IBaseProps } from "../base";
import { CanvasComponent } from "../document/canvas";
import { timeAgo, niceDateTime } from "../../utilities/time";
import { DocumentComponent, WorkspaceSide } from "../document/document";
import { DocumentModelType, DocumentDragKey, LearningLogDocument } from "../../models/document/document";
import { LearningLogWorkspace } from "../../models/stores/workspace";

import "./learning-log.sass";

// cf. learning-log.sass: $list-item-scale
const kLearningLogItemScale = 0.08;

interface IProps extends IBaseProps {}

@inject("stores")
@observer
export class LearningLogComponent extends BaseComponent<IProps, {}> {

  public render() {
    return (
      <div className="learning-log">
        {this.renderDocuments()}
        <div className="logs" data-test="logs">
          <button data-test="learning-log-create-button" onClick={this.handleCreateLearningLog}>Create</button>
          {this.renderLearningLogs()}
        </div>
      </div>
    );
  }

  private renderDocuments() {
    const {documents, ui, unit} = this.stores;
    const {learningLogWorkspace} = ui;
    const primaryWorkspace = learningLogWorkspace.primaryDocumentKey
                        ? documents.getDocument(learningLogWorkspace.primaryDocumentKey)
                        : null;
    const comparisonWorkspace = learningLogWorkspace.comparisonDocumentKey
                        ? documents.getDocument(learningLogWorkspace.comparisonDocumentKey)
                        : null;
    const toolbar = unit && getSnapshot(unit.toolbar);

    if (!primaryWorkspace) {
      return (
        <div className="workspaces">
          {this.renderWorkspace("single-workspace", "primary", "learning-log-workspaces")}
        </div>
      );
    }

    if (learningLogWorkspace.comparisonVisible) {
      return (
        <div className="workspaces">
          {this.renderWorkspace(
              "left-workspace",
              "primary",
              "learning-log-left-workspace",
              <DocumentComponent
                document={primaryWorkspace}
                workspace={learningLogWorkspace}
                toolbar={toolbar}
                side="primary" />
          )}
          {this.renderWorkspace(
              "right-workspace", "comparison", "learning-log-right-workspace", comparisonWorkspace
              ? <DocumentComponent
                  document={comparisonWorkspace}
                  workspace={learningLogWorkspace}
                  readOnly={true}
                  side="comparison" />
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
              "learning-log-single-workspace",
               <DocumentComponent
                document={primaryWorkspace}
                workspace={learningLogWorkspace}
                toolbar={toolbar}
                side="primary"/>
          )}
        </div>
      );
    }
  }

  private renderWorkspace(className: string, side: WorkspaceSide, dataTest: string, child?: JSX.Element) {
    return (
      <div
        onMouseOver={this.handleContractRightNav}
        className={className}
        data-test={dataTest}
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
            <div className="list-item" key={learningLog.key} data-test="learning-log-list-items">
              <div
                className="scaled-list-item-container"
                onClick={this.handleLearningLogClicked(learningLog)}
                onDragStart={this.handleLearningLogDragStart(learningLog)}
                draggable={true}
              >
                <div className="scaled-list-item">
                  <CanvasComponent context="learning-log" document={learningLog}
                                    readOnly={true} scale={kLearningLogItemScale} />
                </div>
              </div>
              <div className="info">
                <div
                  className="title"
                  title={learningLog.title}
                  data-test="learning-log-list-item-title"
                  onClick={this.handleRenameLearningLog(learningLog)}>
                    {learningLog.title}
                </div>
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
    if (e.dataTransfer.getData(DocumentDragKey)) {
      e.preventDefault();
    }
  }

  private handleDrop = (side: WorkspaceSide) => {
    return (e: React.DragEvent<HTMLDivElement>) => {
      const {ui, documents} = this.stores;
      const documentKey = e.dataTransfer.getData(DocumentDragKey);
      const document = documentKey && documents.getDocument(documentKey);
      if (document) {
        if (side === "primary") {
          if (document.type === LearningLogWorkspace) {
            ui.learningLogWorkspace.setPrimaryDocument(document);
          }
          else {
            ui.alert("Please select a Learning Log first.", "Drop into Learning Log");
          }
        }
        else {
          ui.learningLogWorkspace.setComparisonDocument(document);
        }
      }
    };
  }

  private handleCreateLearningLog = () => {
    this.stores.ui.prompt("Enter name of learning log", "", "Create Learning Log")
      .then((title: string) => {
        this.stores.db.createLearningLogDocument(title)
          .then(this.handleSelectLearningLog)
          .catch(this.stores.ui.setError);
      });
  }

  private handleLearningLogClicked = (learningLog: DocumentModelType) => {
    return (e: React.MouseEvent<HTMLDivElement>) => {
      this.handleSelectLearningLog(learningLog);
    };
  }

  private handleSelectLearningLog = (learningLog: DocumentModelType) => {
    this.stores.ui.learningLogWorkspace.setAvailableDocument(learningLog);
  }

  private handleLearningLogDragStart = (learningLog: DocumentModelType) => {
    return (e: React.DragEvent<HTMLDivElement>) => {
      e.dataTransfer.setData(DocumentDragKey, learningLog.key);
    };
  }

  private handleRenameLearningLog = (learningLog: DocumentModelType) => {
    const {ui} = this.stores;
    return (e: React.MouseEvent<HTMLSpanElement>) => {
      this.stores.ui.prompt("Enter new name of learning log", learningLog.title, "Renaming Learning Log")
        .then((title: string) => {
          if (title !== learningLog.title) {
            learningLog.setTitle(title);
          }
        });
    };
  }

  private handleContractRightNav = (e: React.DragEvent<HTMLDivElement>) => {
    this.stores.ui.toggleRightNav(false);
  }

  private getSortedLearningLogs() {
    const {documents, user} = this.stores;
    return documents.byTypeForUser(LearningLogDocument, user.id).slice().sort((a, b) => b.createdAt - a.createdAt);
  }
}
