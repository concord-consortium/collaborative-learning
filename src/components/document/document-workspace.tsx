import { inject, observer } from "mobx-react";
import { getSnapshot } from "mobx-state-tree";
import * as React from "react";
import { LeftNavComponent } from "../../components/navigation/left-nav";
import { RightNavComponent } from "../../components/navigation/right-nav";
import { DocumentComponent } from "../../components/document/document";
import { BaseComponent, IBaseProps } from "../../components/base";
import { DocumentDragKey, DocumentModel, DocumentModelType, LearningLogDocument, OtherDocumentType,
         PersonalDocument, ProblemDocument, PublicationDocument, PersonalPublication, LearningLogPublication,
         SupportPublication } from "../../models/document/document";
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
    this.guaranteeInitialDocuments();
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

  private async guaranteeInitialDocuments() {
    const { appConfig: { defaultDocumentType, defaultDocumentContent,
                         defaultLearningLogDocument, defaultInitialLearningLogTitle },
            db, ui: { problemWorkspace } } = this.stores;
    if (!problemWorkspace.primaryDocumentKey) {
      const defaultDocument = await db.guaranteeOpenDefaultDocument(defaultDocumentType, defaultDocumentContent);
      if (defaultDocument) {
        problemWorkspace.setPrimaryDocument(defaultDocument);
      }
    }
    // Guarantee the user starts with one learning log
    defaultLearningLogDocument && await db.guaranteeLearningLog(defaultInitialLearningLogTitle);
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
              onNewDocument={this.handleNewDocument}
              onCopyDocument={this.handleCopyDocument}
              onDeleteDocument={this.handleDeleteDocument}
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
                onNewDocument={this.handleNewDocument}
                onCopyDocument={this.handleCopyDocument}
                onDeleteDocument={this.handleDeleteDocument}
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

  private handleNewDocument = (document: DocumentModelType) => {
    const { appConfig, user } = this.stores;
    const docType = document.isLearningLog ? LearningLogDocument : PersonalDocument;
    const defaultDocTitle = document.isLearningLog
                            ? appConfig.defaultLearningLogTitle
                            : appConfig.defaultDocumentTitle;
    const docTypeString = appConfig.getDocumentLabel(docType, 1);
    const nextTitle = this.stores.documents.getNextOtherDocumentTitle(user, docType, defaultDocTitle);
    this.stores.ui.prompt(`Name your new ${docTypeString}:`, `${nextTitle}`, `Create ${docTypeString}`)
      .then((title: string) => {
        this.handleNewDocumentOpen(docType, title)
        .catch(this.stores.ui.setError);
      });
  }

  private handleNewDocumentOpen = async (type: OtherDocumentType, title: string) => {
    const { appConfig, db, ui: { problemWorkspace } } = this.stores;
    const content = (type === PersonalDocument) && appConfig.defaultDocumentTemplate
                      ? appConfig.defaultDocumentContent : undefined;
    const newDocument = await db.createOtherDocument(type, {title, content});
    if (newDocument) {
      problemWorkspace.setAvailableDocument(newDocument);
    }
  }

  private handleCopyDocument = (document: DocumentModelType) => {
    const { appConfig } = this.stores;
    const docTypeString = appConfig.getDocumentLabel(document.type, 1);
    this.stores.ui.prompt(`Give your ${docTypeString} copy a new name:`,
                          `Copy of ${document.title || this.stores.problem.title}`, `Copy ${docTypeString}`)
      .then((title: string) => {
        this.handleCopyDocumentOpen(document, title)
        .catch(this.stores.ui.setError);
      });
  }

  private handleCopyDocumentOpen = async (document: DocumentModelType, title: string) => {
    const { db, ui: { problemWorkspace } } = this.stores;
    const copyDocument = await db.copyOtherDocument(document, title);
    if (copyDocument) {
      problemWorkspace.setAvailableDocument(copyDocument);
    }
  }

  private handleDeleteDocument = (document: DocumentModelType) => {
    const { appConfig } = this.stores;
    const docTypeString = appConfig.getDocumentLabel(document.type, 1);
    this.stores.ui.confirm(`Delete this ${docTypeString}? ${document.title}`, `Delete ${docTypeString}`)
      .then((confirmDelete: boolean) => {
        const docType = document.type;
        if (confirmDelete && ((docType === PersonalDocument) || (docType === LearningLogDocument))) {
          document.setProperty("isDeleted", "true");
          this.handleDeleteOpenPrimaryDocument();
        }
      });
  }

  private handleDeleteOpenPrimaryDocument = async () => {
    const { appConfig: { defaultDocumentType, defaultDocumentContent },
            db, ui: { problemWorkspace } } = this.stores;
    const defaultDocument = await db.guaranteeOpenDefaultDocument(defaultDocumentType, defaultDocumentContent);
    if (defaultDocument) {
      problemWorkspace.setPrimaryDocument(defaultDocument);
    }
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
        }
        return ghostProblemDocuments[ghostSectionId];
      }
      return this.stores.documents.getDocument(documentKey);
    }
  }
}
