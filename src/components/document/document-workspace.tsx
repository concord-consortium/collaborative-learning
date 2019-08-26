import { inject, observer } from "mobx-react";
import { getSnapshot } from "mobx-state-tree";
import * as React from "react";
import { LeftNavComponent } from "../../components/navigation/left-nav";
import { RightNavComponent } from "../../components/navigation/right-nav";
import { DocumentComponent } from "../../components/document/document";
import { BaseComponent, IBaseProps } from "../../components/base";
import { DocumentDragKey, DocumentModelType, DocumentModel, ProblemDocument } from "../../models/document/document";
import { parseGhostSectionDocumentKey } from "../../models/stores/workspace";

import "./document-workspace.sass";

type WorkspaceSide = "primary" | "comparison";

interface IProps extends IBaseProps {
  isGhostUser: boolean;
}

// keep ghost documents out of MST
interface GhostDocumentMap {
  [key: string]: DocumentModelType;
}
const ghostProblemDocuments: GhostDocumentMap = {};

@inject("stores")
@observer
export class DocumentWorkspaceComponent extends BaseComponent<IProps, {}> {

  public componentDidMount() {
    this.guaranteePrimaryDocument();
  }

  public render() {
    const { appConfig } = this.stores;
    const isGhostUser = this.props.isGhostUser;
    return (
      <div className="document-workspace">
        {this.renderDocuments(isGhostUser)}
        <LeftNavComponent isGhostUser={isGhostUser} />
        <RightNavComponent tabs={appConfig.rightNavTabs} isGhostUser={isGhostUser} />
      </div>
    );
  }

  private async guaranteePrimaryDocument() {
    const { db, ui: { problemWorkspace } } = this.stores;
    if (!problemWorkspace.primaryDocumentKey) {
      const problemDocument = await db.guaranteeOpenProblemDocument();
      if (problemDocument) {
        problemWorkspace.setPrimaryDocument(problemDocument);
      }
    }
  }

  private renderDocuments(isGhostUser: boolean) {
    const {appConfig, documents, ui} = this.stores;
    const {problemWorkspace} = ui;
    const primaryDocument = this.getPrimaryDocument(problemWorkspace.primaryDocumentKey);
    const comparisonDocument = problemWorkspace.comparisonDocumentKey
                               && documents.getDocument(problemWorkspace.comparisonDocumentKey);
    const toolbar = appConfig && getSnapshot(appConfig.toolbar);

    if (!primaryDocument) {
      return this.renderDocument("single-workspace", "primary");
    }

    if (problemWorkspace.comparisonVisible) {
      return (
        <div onClick={this.handleClick}>
          {this.renderDocument(
            "left-workspace",
            "primary",
            <DocumentComponent
              document={primaryDocument}
              workspace={problemWorkspace}
              toolbar={toolbar}
              side="primary"
              isGhostUser={isGhostUser}
            />
          )}
          {this.renderDocument("right-workspace", "comparison", comparisonDocument
              ? <DocumentComponent
                  document={comparisonDocument}
                  workspace={problemWorkspace}
                  readOnly={true}
                  side="comparison"
                  isGhostUser={isGhostUser}
                />
              : this.renderComparisonPlaceholder())}
        </div>
      );
    }
    else {
      return this.renderDocument(
              "single-workspace",
              "primary",
              <DocumentComponent
                document={primaryDocument}
                workspace={problemWorkspace}
                toolbar={toolbar}
                side="primary"
                isGhostUser={isGhostUser}
              />
            );
    }
  }

  private renderDocument(className: string, side: WorkspaceSide, child?: JSX.Element) {
    const { appConfig } = this.stores;
    const hasRightNavTabs = appConfig.rightNavTabs && (appConfig.rightNavTabs.length > 0);
    const style = hasRightNavTabs ? undefined : { right: 0 };
    return (
      <div
        className={className}
        style={style}
        onDragOver={this.handleDragOver}
        onDrop={this.handleDrop(side)}
        onClick={this.handleClick}
      >
        {child}
      </div>
    );
  }

  private renderComparisonPlaceholder() {
    return (
      <div
        className="comparison-placeholder"
        onDragOver={(this.handleDragOver)}
        onDrop={this.handleDrop("comparison")}
        onClick={this.handleClick}
      >
        Click or drag an item in the right tabs to show it here
      </div>
    );
  }

  private handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer.types.find((type) => type === DocumentDragKey)) {
      e.preventDefault();
    }
  }

  private handleDrop = (side: WorkspaceSide) => {
    return (e: React.DragEvent<HTMLDivElement>) => {
      const {ui, documents} = this.stores;
      const {problemWorkspace} = ui;
      const documentKey = e.dataTransfer && e.dataTransfer.getData(DocumentDragKey);
      const document = documentKey ? documents.getDocument(documentKey) : null;
      if (document) {
        if (side === "primary") {
          problemWorkspace.setPrimaryDocument(document);
        }
        else {
          problemWorkspace.setComparisonDocument(document);
        }
      }
    };
  }

  private handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    this.stores.ui.contractAll();
  }

  private getPrimaryDocument(documentKey?: string) {
    if (documentKey) {
      const ghostSectionId = parseGhostSectionDocumentKey(documentKey);
      if (ghostSectionId) {
        if (!ghostProblemDocuments[ghostSectionId]) {
          // Ghosts don't store section documents in Firebase, so we create fake ones here for convenience
          ghostProblemDocuments[ghostSectionId] = DocumentModel.create({
            uid: "ghost",
            type: ProblemDocument,
            key: ghostSectionId,
            createdAt: 1,
            content: {},
          });

          // The creation of normal documents would start listeners for group documents in the same section
          // Since the creation of ghost documents is faked, listeners must be started manually here
          this.stores.db.listeners.updateGroupUserProblemDocumentListeners(ghostProblemDocuments[ghostSectionId]);
        }
        return ghostProblemDocuments[ghostSectionId];
      }
      return this.stores.documents.getDocument(documentKey);
    }
  }
}
