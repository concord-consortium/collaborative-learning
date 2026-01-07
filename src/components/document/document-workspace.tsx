import { inject, observer } from "mobx-react";
import React from "react";
import { DocumentComponent, WorkspaceSide } from "../../components/document/document";
import { GroupVirtualDocumentComponent } from "../../components/document/group-virtual-document";
import { BaseComponent, IBaseProps } from "../../components/base";
import { DocumentModelType } from "../../models/document/document";
import { DocumentContentModel, DocumentContentModelType } from "../../models/document/document-content";
import { createDefaultSectionedContent } from "../../models/document/sectioned-content";
import {
  DocumentDragKey, GroupDocument, LearningLogDocument, OtherDocumentType, PersonalDocument, ProblemDocument
} from "../../models/document/document-types";
import { ImageDragDrop } from "../utilities/image-drag-drop";
import {
  removeLoadingMessage, showLoadingMessage, logLoadingAndDocumentMeasurements
} from "../../utilities/loading-utils";
import { kImageTileType } from "../../models/tiles/image/image-content";

import "./document-workspace.scss";

interface IProps extends IBaseProps {
}


@inject("stores")
@observer
export class DocumentWorkspaceComponent extends BaseComponent<IProps> {
  private imageDragDrop: ImageDragDrop;
  private primaryDocument?: DocumentModelType;
  private primaryDocumentLoaded = false;

  constructor(props: IProps) {
    super(props);

    showLoadingMessage("Building workspace");
    this.imageDragDrop = new ImageDragDrop({
      isAcceptableImageDrag: this.isAcceptableImageDrag
    });
  }

  public componentDidMount() {
    this.guaranteeInitialDocuments();
  }

  public componentDidUpdate(): void {
    // ----------------------- Logging Loading & Document Measurements -------------------------
    if (!this.primaryDocumentLoaded) {
      const { documents, teacherGuide, persistentUI } = this.stores;
      const { problemWorkspace } = persistentUI;
      const primaryDocument = this.getPrimaryDocument(problemWorkspace.primaryDocumentKey);
      if (primaryDocument) {
        this.primaryDocumentLoaded = true;
        const sections = this.stores.problem.sections;
        // Take into account that teachers have extra "curriculum documents" in the TeacherGuide tab
        let curriculumDocSections = [...sections]; //these are for the "Problem" tab
        if (teacherGuide) {
          curriculumDocSections = [...curriculumDocSections, ...teacherGuide.sections];
        }
        removeLoadingMessage("Building workspace");
        logLoadingAndDocumentMeasurements(documents, curriculumDocSections, primaryDocument);
      }
    }
  }

  public render() {
    const { appMode, appConfig: { toolbar }, documents, persistentUI, groups } = this.stores;
    const { problemWorkspace } = persistentUI;
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
            onOpenGroupDocument={this.handleOpenGroupDocument}
            onCopyDocument={this.handleCopyDocument}
            onDeleteDocument={this.handleDeleteDocument}
            toolbar={toolbar}
            side="comparison"
            readOnly={true}
          />
        : this.renderComparisonPlaceholder();

    const Primary =
      <DocumentComponent
        document={primaryDocument}
        workspace={problemWorkspace}
        onNewDocument={this.handleNewDocument}
        onOpenGroupDocument={this.handleOpenGroupDocument}
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

  private getDefaultDocumentContentSpec() {
    const { appConfig: { defaultDocumentType: type, defaultDocumentTemplate } } = this.stores;
    return { type, content: DocumentContentModel.create(defaultDocumentTemplate) };
  }

  private getDefaultSectionedDocumentContent(defaultType: string, defaultContent?: DocumentContentModelType) {
    const { appConfig: { autoSectionProblemDocuments }, problem } = this.stores;
    if ((defaultType === ProblemDocument) && autoSectionProblemDocuments) {
      // for problem documents, default content is a section header row and a placeholder tile
      // for each section that is present in the corresponding problem content
      return createDefaultSectionedContent({ sections: problem.sections });
    }
    return defaultContent;
  }

  private async guaranteeInitialDocuments() {
    const { appConfig: { defaultLearningLogDocument, defaultLearningLogTitle, initialLearningLogTitle },
            db, persistentUI: { problemWorkspace }, sectionsLoadedPromise,
            unit: { planningDocument }, user: { type: role } } = this.stores;

    if (!problemWorkspace.primaryDocumentKey) {
      const { type, content } = this.getDefaultDocumentContentSpec();
      await sectionsLoadedPromise;
      const documentContent = this.getDefaultSectionedDocumentContent(type, content);
      const defaultDocument = await db.guaranteeOpenDefaultDocument(type, documentContent);
      if (defaultDocument) {
        problemWorkspace.setPrimaryDocument(defaultDocument);
      }
    } else {
      // If the primary document is a group document, make sure it is opened properly.
      // This is because group documents are not loaded automatically like other documents.
      // This will be loading the metadata even if this isn't a group document, that might
      // be a little inefficient but it should only happens if the user has a group document
      // open in the their last CLUE session when they open CLUE again.
      const primaryDocMetadata = await db.findFirestoreMetadata(problemWorkspace.primaryDocumentKey);
      if (primaryDocMetadata && primaryDocMetadata.type === GroupDocument) {
        db.openGroupDocument(primaryDocMetadata);
      }
    }
    // Guarantee the user starts with one learning log
    defaultLearningLogDocument && await db.guaranteeLearningLog(initialLearningLogTitle || defaultLearningLogTitle);
    planningDocument?.isEnabledForRole(role) && planningDocument.default &&
      await db.guaranteePlanningDocument(planningDocument.sections);
  }

  private renderDocument(className: string, side: WorkspaceSide, child?: JSX.Element) {
    const roleClassName = side === "primary" ? "primary-workspace" : "reference-workspace";
    return (
      <div
        className={`${className} ${roleClassName}`}
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
    return !!this.getPrimaryDocument(this.stores.persistentUI.problemWorkspace.primaryDocumentKey);
  };

  private handleDragOverSide = (e: React.DragEvent<HTMLDivElement>) => {
    if (this.imageDragDrop.dragOver(e) || e.dataTransfer.types.find((type) => type === DocumentDragKey)) {
      e.preventDefault();
    }
  };

  private handleDropSide = (side: WorkspaceSide) => {
    return (e: React.DragEvent<HTMLDivElement>) => {
      const {persistentUI, documents} = this.stores;
      const documentKey = e.dataTransfer && e.dataTransfer.getData(DocumentDragKey);
      if (documentKey) {
        const {problemWorkspace} = persistentUI;
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
    const {persistentUI, ui } = this.stores;
    this.imageDragDrop.drop(e)
      .then((url) => {
        const primaryDocument = this.getPrimaryDocument(persistentUI.problemWorkspace.primaryDocumentKey);
        if (primaryDocument?.content) {
          // insert the tile after the row it was dropped on otherwise add to end of document
          const rowIndex = rowId ? primaryDocument.content?.getRowIndex(rowId) : undefined;
          const rowInsertIndex = (rowIndex !== undefined ? rowIndex + 1 : primaryDocument.content?.rowOrder.length);
          primaryDocument.content.userAddTile(kImageTileType, {
            url,
            title: primaryDocument.content.getUniqueTitleForType(kImageTileType),
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

  private handleOpenGroupDocument = async () => {
    console.log("DocumentWorkspaceComponent.handleOpenGroupDocument");
    const { db, persistentUI: { problemWorkspace } } = this.stores;
    const groupDocument = await db.getOrCreateGroupDocument();

    if (groupDocument) {
      problemWorkspace.setPrimaryDocument(groupDocument);
    }

    // TODO: Handle existing group documents
    // For other documents there are requiredDocuments that is used to only load one document.
    // This is even used for loading personal documents where there can be multiple personal documents.
    // It doesn't seem to make sense to "require" group documents. But it is true there will
    // be only one group document so we could use this same approach.
    // Regardless of how it works, we should make a new listener that watches for the creation
    // and updating of group documents in the db-listeners directory.
    // And then wait for that listener to load the group document before setting it here.
    // For now we just have createGroupDocument call openDocument directly.
  };

  private defaultOtherDocumentContent = (type: OtherDocumentType) => {
    const { appConfig: { defaultDocumentTemplate } } = this.stores;
    const template = type === PersonalDocument ? defaultDocumentTemplate : undefined;
    return DocumentContentModel.create(template);
  };

  private handleNewDocumentOpen = async (type: OtherDocumentType, title: string) => {
    const { db, persistentUI: { problemWorkspace } } = this.stores;
    const content = this.defaultOtherDocumentContent(type);
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
    const { db, persistentUI: { problemWorkspace } } = this.stores;
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
    const { db, persistentUI: { problemWorkspace } } = this.stores;
    const { type, content } = this.getDefaultDocumentContentSpec();
    const defaultDocument = await db.guaranteeOpenDefaultDocument(type, content);
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
