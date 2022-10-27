import { inject, observer } from "mobx-react";
import React from "react";
import { DocumentComponent, WorkspaceSide } from "../../components/document/document";
import { GroupVirtualDocumentComponent } from "../../components/document/group-virtual-document";
import { BaseComponent, IBaseProps } from "../../components/base";
import { DocumentModelType } from "../../models/document/document";
import { DocumentContentModelType } from "../../models/document/document-content";
import { createDefaultSectionedContent } from "../../models/document/document-content-import";
import {
  DocumentDragKey, LearningLogDocument, OtherDocumentType, PersonalDocument, ProblemDocument
} from "../../models/document/document-types";
import { ImageDragDrop } from "../utilities/image-drag-drop";

import "./document-workspace.sass";

interface IProps extends IBaseProps {
  isExpanderShown: boolean;
}

@inject("stores")
@observer
export class DocumentWorkspaceComponent extends BaseComponent<IProps> {
  private imageDragDrop: ImageDragDrop;

  constructor(props: IProps) {
    super(props);

    this.imageDragDrop = new ImageDragDrop({
      isAcceptableImageDrag: this.isAcceptableImageDrag
    });
  }

  public componentDidMount() {
    this.guaranteeInitialDocuments();
  }

  public render() {
    const { appMode, appConfig: { toolbar }, documents, ui, groups } = this.stores;
    const { problemWorkspace } = ui;
    const { comparisonDocumentKey, hidePrimaryForCompare, comparisonVisible } = problemWorkspace;
    const showPrimary = !hidePrimaryForCompare;
    const primaryDocument = this.getPrimaryDocument(problemWorkspace.primaryDocumentKey);
    const comparisonDocument = comparisonDocumentKey
                               && documents.getDocument(comparisonDocumentKey);

    const groupVirtualDocument = comparisonDocumentKey
      && groups.virtualDocumentForGroup(comparisonDocumentKey);

    if (!primaryDocument) {
      return this.renderDocument("single-workspace", "primary");
    }

    const CompareDocument = groupVirtualDocument
      ? <GroupVirtualDocumentComponent
          key={comparisonDocumentKey}
          document={groupVirtualDocument}
        />
      : comparisonDocument
        ?
          <DocumentComponent
            document={comparisonDocument}
            workspace={problemWorkspace}
            onNewDocument={this.handleNewDocument}
            onCopyDocument={this.handleCopyDocument}
            onDeleteDocument={this.handleDeleteDocument}
            toolbar={toolbar}
            side="comparison"
            readOnly={true}
          />
        : this.renderComparisonPlaceholder();
    {console.log("comparisonDocument:", comparisonDocument);}
    const Primary =
      <DocumentComponent
        document={primaryDocument}
        workspace={problemWorkspace}
        onNewDocument={this.handleNewDocument}
        onCopyDocument={this.handleCopyDocument}
        onDeleteDocument={this.handleDeleteDocument}
        onAdminDestroyDocument={appMode === "dev" ? this.handleAdminDestroyDocument : undefined}
        toolbar={toolbar}
        side="primary"
      />;

    // Show Primary and comparison docs:
    if (comparisonVisible && showPrimary) {
      return (
        <div onClick={this.handleClick}>
          { this.renderDocument("left-workspace", "primary", Primary) }
          { this.renderDocument("right-workspace", "comparison", CompareDocument) }
        </div>
      );
    }
    // Just display the "Compare" document.
    else if (hidePrimaryForCompare) {
      return this.renderDocument("single-workspace", "primary", CompareDocument);
    }
    // Just display the primary document:
    else {
      return this.renderDocument("single-workspace", "primary", Primary);
    }
  }

  private getDefaultDocumentContent(defaultType: string, defaultContent?: DocumentContentModelType) {
    const { appConfig: { autoSectionProblemDocuments }, problem } = this.stores;
    if ((defaultType === ProblemDocument) && autoSectionProblemDocuments) {
      // for problem documents, default content is a section header row and a placeholder tile
      // for each section that is present in the corresponding problem content
      return createDefaultSectionedContent(problem.sections);
    }
    return defaultContent;
  }

  private async guaranteeInitialDocuments() {
    const { appConfig: { defaultDocumentSpec: { type: defaultType, content: defaultContent },
            defaultLearningLogDocument, defaultLearningLogTitle, initialLearningLogTitle },
            db, ui: { problemWorkspace }, unit: { planningDocument }, user: { type: role } } = this.stores;
    if (!problemWorkspace.primaryDocumentKey) {
      const documentContent = this.getDefaultDocumentContent(defaultType, defaultContent);
      const defaultDocument = await db.guaranteeOpenDefaultDocument(defaultType, documentContent);
      if (defaultDocument) {
        problemWorkspace.setPrimaryDocument(defaultDocument);
      }
    }
    // Guarantee the user starts with one learning log
    defaultLearningLogDocument && await db.guaranteeLearningLog(initialLearningLogTitle || defaultLearningLogTitle);
    planningDocument?.isEnabledForRole(role) && planningDocument.default &&
      await db.guaranteePlanningDocument(planningDocument.sections);
  }

  private renderDocument(className: string, side: WorkspaceSide, child?: JSX.Element) {
    const { appConfig: { navTabs: { showNavPanel } }, ui } = this.stores;
    const workspaceLeft = !showNavPanel
                            ? 0
                            : ui.navTabContentShown && !this.props.isExpanderShown
                              ? "50%"
                              : this.props.isExpanderShown ? "calc(50% + 35px)" : 38;
    const style = { left: workspaceLeft };
    const roleClassName = side === "primary" ? "primary-workspace" : "reference-workspace";
    return (
      <div
        className={`${className} ${roleClassName}`}
        style={style}
        onDragOver={this.handleDragOverSide}
        onDrop={this.handleDropSide(side)}
        onClick={this.handleClick}
      >
        {child}
      </div>
    );
  }

  private renderComparisonPlaceholder() {
    const { appConfig } = this.stores;
    const placeholderContent = Array.isArray(appConfig.comparisonPlaceholderContent)
                                ? appConfig.comparisonPlaceholderContent.map(str => <div key={str}>{str}</div>)
                                : appConfig.comparisonPlaceholderContent;
    return (
      <div
        className="comparison-placeholder"
        onDragOver={(this.handleDragOverSide)}
        onDrop={this.handleDropSide("comparison")}
        onClick={this.handleClick}
      >
        {placeholderContent}
      </div>
    );
  }

  private isAcceptableImageDrag = (e: React.DragEvent<HTMLDivElement>) => {
    // make sure we have a primary document to drop onto
    return !!this.getPrimaryDocument(this.stores.ui.problemWorkspace.primaryDocumentKey);
  };

  private handleDragOverSide = (e: React.DragEvent<HTMLDivElement>) => {
    if (this.imageDragDrop.dragOver(e) || e.dataTransfer.types.find((type) => type === DocumentDragKey)) {
      e.preventDefault();
    }
  };

  private handleDropSide = (side: WorkspaceSide) => {
    return (e: React.DragEvent<HTMLDivElement>) => {
      const {ui, documents} = this.stores;
      const documentKey = e.dataTransfer && e.dataTransfer.getData(DocumentDragKey);
      if (documentKey) {
        const {problemWorkspace} = ui;
        const document = documents.getDocument(documentKey);
        if (document) {
          if ((side === "primary") && !document.isPublished) {
            problemWorkspace.setPrimaryDocument(document);
          }
          else {
            problemWorkspace.viewComparisonDocument(document);
          }
        }
      }
      else {
        // try to get the row it was dropped on
        let rowNode = e.target as HTMLElement | null;
        while (rowNode && (rowNode.className !== "tile-row")) {
          rowNode = rowNode.parentNode as HTMLElement | null;
        }
        const rowId = (rowNode && rowNode.dataset && rowNode.dataset.rowId) || undefined;
        this.handleImageDrop(e, rowId);
      }
    };
  };

  private handleImageDrop = (e: React.DragEvent<HTMLDivElement>, rowId?: string) => {
    const {ui} = this.stores;
    this.imageDragDrop.drop(e)
      .then((url) => {
        const primaryDocument = this.getPrimaryDocument(ui.problemWorkspace.primaryDocumentKey);
        if (primaryDocument?.content) {
          // insert the tile after the row it was dropped on otherwise add to end of document
          const rowIndex = rowId ? primaryDocument.content?.getRowIndex(rowId) : undefined;
          const rowInsertIndex = (rowIndex !== undefined ? rowIndex + 1 : primaryDocument.content?.rowOrder.length);
          primaryDocument.content.userAddTile("image", {
            url,
            insertRowInfo: {
              rowInsertIndex
            }
          });
        }
      })
      .catch((err) => {
        ui.alert(err.toString());
      });
  };

  private handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // placeholder
  };

  private handleNewDocument = (type: string) => {
    const { appConfig, documents, ui, user } = this.stores;
    const isLearningLog = type === LearningLogDocument;
    const docType = isLearningLog ? LearningLogDocument : PersonalDocument;
    const defaultDocTitle = isLearningLog
                            ? appConfig.defaultLearningLogTitle
                            : appConfig.defaultDocumentTitle;
    const docTypeString = appConfig.getDocumentLabel(docType, 1);
    const docTypeStringL = appConfig.getDocumentLabel(docType, 1, true);
    const nextTitle = documents.getNextOtherDocumentTitle(user, docType, defaultDocTitle);
    ui.prompt({
        className: `create-${type}`,
        title: `Create ${docTypeString}`,
        text: `Name your new ${docTypeStringL}:`,
        defaultValue: `${nextTitle}`,
      })
      .then((title: string) => {
        this.handleNewDocumentOpen(docType, title)
        .catch(error => ui.setError(error));
      });
  };

  private handleNewDocumentOpen = async (type: OtherDocumentType, title: string) => {
    const { appConfig, db, ui: { problemWorkspace } } = this.stores;
    const content = (type === PersonalDocument) && appConfig.hasDefaultDocumentTemplate
                      ? appConfig.defaultDocumentContent : undefined;
    const newDocument = await db.createOtherDocument(type, {title, content});
    if (newDocument) {
      problemWorkspace.setPrimaryDocument(newDocument);
    }
  };

  private handleCopyDocument = (document: DocumentModelType) => {
    const { appConfig, ui } = this.stores;
    const docTypeString = document.getLabel(appConfig, 1);
    const docTypeStringL = document.getLabel(appConfig, 1, true);
    const originTitle = document?.properties?.get("originTitle");
    const baseTitle = appConfig.copyPreferOriginTitle && originTitle
                        ? originTitle
                        : document.title || this.stores.problem.title;
    ui.prompt(`Give your ${docTypeStringL} copy a new name:`,
              `Copy of ${baseTitle}`, `Copy ${docTypeString}`)
      .then((title: string) => {
        this.handleCopyDocumentOpen(document, title)
        .catch(error => ui.setError(error));
      });
  };

  private handleCopyDocumentOpen = async (document: DocumentModelType, title: string) => {
    const { db, ui: { problemWorkspace } } = this.stores;
    const copyDocument = await db.copyOtherDocument(document, { title, asTemplate: true });
    if (copyDocument) {
      problemWorkspace.setPrimaryDocument(copyDocument);
    }
  };

  private handleDeleteDocument = (document: DocumentModelType) => {
    const { appConfig } = this.stores;
    const docTypeString = document.getLabel(appConfig, 1);
    const docTypeStringL = document.getLabel(appConfig, 1, true);
    this.stores.ui.confirm(`Delete this ${docTypeStringL}? ${document.title}`, `Delete ${docTypeString}`)
    .then((confirmDelete: boolean) => {
      if (confirmDelete) {
        document.setProperty("isDeleted", "true");
        this.handleDeleteOpenPrimaryDocument();
      }
    });
  };

  private handleAdminDestroyDocument = (document: DocumentModelType) => {
    const { appConfig, db, ui } = this.stores;
    const docTypeString = document.getLabel(appConfig, 1);
    const docTypeStringL = document.getLabel(appConfig, 1, true);
    const documentString = `${document.type} ${docTypeStringL} (${document.title || ""})`;
    ui.confirm(`Destroy this ${documentString} from the database and reload the page?`,
                `Destroy ${docTypeString}`)
    .then((confirmDelete: boolean) => {
      if (confirmDelete) {
        db.destroyFirebaseDocument(document);
        window.location.reload();
      }
    });
  };

  private handleDeleteOpenPrimaryDocument = async () => {
    const { appConfig: { defaultDocumentType, defaultDocumentContent },
            db, ui: { problemWorkspace } } = this.stores;
    const defaultDocument = await db.guaranteeOpenDefaultDocument(defaultDocumentType, defaultDocumentContent);
    if (defaultDocument) {
      problemWorkspace.setPrimaryDocument(defaultDocument);
    }
  };

  private getPrimaryDocument(documentKey?: string) {
    if (documentKey) {
      return this.stores.documents.getDocument(documentKey);
    }
  }
}
