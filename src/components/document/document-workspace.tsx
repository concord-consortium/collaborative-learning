import { inject, observer } from "mobx-react";
import { getSnapshot } from "mobx-state-tree";
import * as React from "react";
import { LeftNavComponent } from "../../components/navigation/left-nav";
import { RightNavComponent } from "../../components/navigation/right-nav";
import { DocumentComponent } from "../../components/document/document";
import { GroupVirtualDocumentComponent } from "../../components/document/group-virtual-document";
import { BaseComponent, IBaseProps } from "../../components/base";
import { kAllSectionType, getSectionPlaceholder } from "../../models/curriculum/section";
import { DocumentDragKey, DocumentModel, DocumentModelType, LearningLogDocument, OtherDocumentType,
         PersonalDocument, ProblemDocument } from "../../models/document/document";
import { DocumentContentModel } from "../../models/document/document-content";
import { AudienceModelType, ClassAudienceModel, SectionTarget } from "../../models/stores/supports";
import { parseGhostSectionDocumentKey } from "../../models/stores/workspace";
import { ImageDragDrop } from "../utilities/image-drag-drop";

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
  private imageDragDrop: ImageDragDrop;

  public componentWillMount() {
    this.imageDragDrop = new ImageDragDrop({
      isAcceptableImageDrag: this.isAcceptableImageDrag
    });
  }

  public componentDidMount() {
    this.guaranteeInitialDocuments();
  }

  public render() {
    const { appConfig, user } = this.stores;
    const { rightNavTabs } = appConfig;
    const studentTabs = rightNavTabs.filter((t) => !t.teacherOnly);
    const isGhostUser = this.props.isGhostUser;
    const isTeacher = user.isTeacher;
    const tabsToDisplay = isTeacher ? rightNavTabs : studentTabs;
    // NOTE: the drag handlers are in three different divs because we cannot overlay
    // the renderDocuments() div otherwise the Cypress tests will fail because none
    // of the html elements in the documents will be visible to it.  The first div acts
    // as a handler for the background and the left and right nav then delegate dragging
    // and dropping to the same functions
    return (
      <div className="document-workspace">
        <div
          className="drag-handler"
          onDragOver={this.handleDragOverWorkspace}
          onDrop={this.handleImageDrop}
        />
        {this.renderDocuments(isGhostUser)}
        <LeftNavComponent
          isGhostUser={isGhostUser}
          onDragOver={this.handleDragOverWorkspace}
          onDrop={this.handleImageDrop}
        />
        <RightNavComponent
          tabs={appConfig.rightNavTabs}
          isGhostUser={isGhostUser}
          isTeacher={isTeacher}
          onDragOver={this.handleDragOverWorkspace}
          onDrop={this.handleImageDrop}
        />
      </div>
    );
  }

  private getDefaultDocumentContent() {
    const { appConfig: { autoSectionProblemDocuments, defaultDocumentType, defaultDocumentContent },
            problem } = this.stores;
    if ((defaultDocumentType === ProblemDocument) && autoSectionProblemDocuments) {
      const tiles: any = [];
      problem.sections.forEach(section => {
        tiles.push({ content: { isSectionHeader: true, sectionId: section.type }});
        tiles.push({ content: { type: "Placeholder", sectionId: section.type }});
      });
      return DocumentContentModel.create({ tiles } as any);
    }
    else if (defaultDocumentContent) {
      return defaultDocumentContent;
    }
  }

  private async guaranteeInitialDocuments() {
    const { appConfig: { defaultDocumentType, defaultLearningLogDocument,
                        defaultLearningLogTitle, initialLearningLogTitle },
            db, ui: { problemWorkspace } } = this.stores;
    if (!problemWorkspace.primaryDocumentKey) {
      const documentContent = this.getDefaultDocumentContent();
      const defaultDocument = await db.guaranteeOpenDefaultDocument(defaultDocumentType, documentContent);
      if (defaultDocument) {
        problemWorkspace.setPrimaryDocument(defaultDocument);
      }
    }
    // Guarantee the user starts with one learning log
    defaultLearningLogDocument && await db.guaranteeLearningLog(initialLearningLogTitle || defaultLearningLogTitle);
  }

  private renderDocuments(isGhostUser: boolean) {
    const {appConfig, documents, ui, groups} = this.stores;

    const { problemWorkspace } = ui;
    const { comparisonDocumentKey } = problemWorkspace;

    const primaryDocument = this.getPrimaryDocument(problemWorkspace.primaryDocumentKey);
    const comparisonDocument = comparisonDocumentKey
                               && documents.getDocument(comparisonDocumentKey);

    const groupVirtualDocument = comparisonDocumentKey
      && groups.documentForGroup(comparisonDocumentKey);

    const toolbar = appConfig && getSnapshot(appConfig.toolbar);

    if (!primaryDocument) {
      return this.renderDocument("single-workspace", "primary");
    }

    const CompareDocument = groupVirtualDocument
      ? <GroupVirtualDocumentComponent
          key={comparisonDocumentKey}
          document={groupVirtualDocument}
          workspace={problemWorkspace}
        />
      : comparisonDocument
        ?
          <DocumentComponent
            document={comparisonDocument}
            workspace={problemWorkspace}
            onNewDocument={this.handleNewDocument}
            onCopyDocument={this.handleCopyDocument}
            onDeleteDocument={this.handleDeleteDocument}
            onPublishSupport={this.handlePublishSupport}
            onPublishDocument={this.handlePublishDocument}
            toolbar={toolbar}
            side="comparison"
            isGhostUser={isGhostUser}
          />
        : this.renderComparisonPlaceholder();

    const Primary = (
      <DocumentComponent
        document={primaryDocument}
        workspace={problemWorkspace}
        onNewDocument={this.handleNewDocument}
        onCopyDocument={this.handleCopyDocument}
        onDeleteDocument={this.handleDeleteDocument}
        onPublishSupport={this.handlePublishSupport}
        onPublishDocument={this.handlePublishDocument}
        toolbar={toolbar}
        side="primary"
        isGhostUser={isGhostUser}
      />
    );

    if (problemWorkspace.comparisonVisible) {
      return (
        <div onClick={this.handleClick}>
          { this.renderDocument("left-workspace", "primary", Primary) }
          { this.renderDocument("right-workspace", "comparison", CompareDocument) }
        </div>
      );
    }
    else {
      return this.renderDocument("single-workspace", "primary", Primary);
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
        onDragOver={this.handleDragOverSide}
        onDrop={this.handleDropSide(side)}
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
        onDragOver={(this.handleDragOverSide)}
        onDrop={this.handleDropSide("comparison")}
        onClick={this.handleClick}
      >
        Click or drag an item in the right tabs to show it here
      </div>
    );
  }

  private isAcceptableImageDrag = (e: React.DragEvent<HTMLDivElement>) => {
    // make sure we have a primary document to drop onto
    return !!this.getPrimaryDocument(this.stores.ui.problemWorkspace.primaryDocumentKey);
  }

  private handleDragOverWorkspace = (e: React.DragEvent<HTMLDivElement>) => {
    this.imageDragDrop.dragOver(e);
  }

  private handleDragOverSide = (e: React.DragEvent<HTMLDivElement>) => {
    if (this.imageDragDrop.dragOver(e) || e.dataTransfer.types.find((type) => type === DocumentDragKey)) {
      e.preventDefault();
    }
  }

  private handleDropSide = (side: WorkspaceSide) => {
    return (e: React.DragEvent<HTMLDivElement>) => {
      const {ui, documents} = this.stores;
      const documentKey = e.dataTransfer && e.dataTransfer.getData(DocumentDragKey);
      if (documentKey) {
        const {problemWorkspace} = ui;
        const document = documents.getDocument(documentKey);
        if (document) {
          if (side === "primary") {
            problemWorkspace.setPrimaryDocument(document);
          }
          else {
            problemWorkspace.setComparisonDocument(document);
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
  }

  private handleImageDrop = (e: React.DragEvent<HTMLDivElement>, rowId?: string) => {
    const {ui} = this.stores;
    this.imageDragDrop.drop(e)
      .then((url) => {
        const primaryDocument = this.getPrimaryDocument(ui.problemWorkspace.primaryDocumentKey);
        if (primaryDocument) {
          // insert the tile after the row it was dropped on otherwise add to end of document
          const rowIndex = rowId ? primaryDocument.content.getRowIndex(rowId) : undefined;
          const rowInsertIndex = (rowIndex !== undefined ? rowIndex + 1 : primaryDocument.content.rowOrder.length);
          primaryDocument.content.addTile("image", {
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
    const docTypeString = document.getLabel(appConfig, 1);
    const docTypeStringL = document.getLabel(appConfig, 1, true);
    const nextTitle = this.stores.documents.getNextOtherDocumentTitle(user, docType, defaultDocTitle);
    this.stores.ui.prompt(`Name your new ${docTypeStringL}:`, `${nextTitle}`, `Create ${docTypeString}`)
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
    const docTypeString = document.getLabel(appConfig, 1);
    const docTypeStringL = document.getLabel(appConfig, 1, true);
    this.stores.ui.prompt(`Give your ${docTypeStringL} copy a new name:`,
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
    const { appConfig, documents, user } = this.stores;
    const otherDocuments = documents.byTypeForUser(document.type, user.id);
    const countNotDeleted = otherDocuments.reduce((prev, doc) => doc.getProperty("isDeleted") ? prev : prev + 1, 0);
    const docTypeString = document.getLabel(appConfig, 1);
    const docTypeStringL = document.getLabel(appConfig, 1, true);
    if (countNotDeleted <= 1) {
      this.stores.ui.alert(`Cannot delete the last ${docTypeStringL}.`, `Error: Delete ${docTypeString}`);
    }
    else {
      this.stores.ui.confirm(`Delete this ${docTypeStringL}? ${document.title}`, `Delete ${docTypeString}`)
      .then((confirmDelete: boolean) => {
        if (confirmDelete) {
          document.setProperty("isDeleted", "true");
          this.handleDeleteOpenPrimaryDocument();
        }
      });
    }
  }

  private handleDeleteOpenPrimaryDocument = async () => {
    const { appConfig: { defaultDocumentType, defaultDocumentContent },
            db, ui: { problemWorkspace } } = this.stores;
    const defaultDocument = await db.guaranteeOpenDefaultDocument(defaultDocumentType, defaultDocumentContent);
    if (defaultDocument) {
      problemWorkspace.setPrimaryDocument(defaultDocument);
    }
  }

  private getProblemBaseTitle(title: string) {
    const match = /[\d.]*[\s]*(.+)/.exec(title);
    return match && match[1] ? match[1] : title;
  }

  private getSupportDocumentBaseCaption(document: DocumentModelType, sectionTarget: SectionTarget) {
    return document.type === ProblemDocument
            ? this.getProblemBaseTitle(this.stores.problem.title)
            : document.title;
  }

  private handlePublishSupport = async (document: DocumentModelType) => {
    const { db, ui } = this.stores;
    const audience: AudienceModelType = ClassAudienceModel.create();
    const sectionTarget: SectionTarget = kAllSectionType;
    const caption = this.getSupportDocumentBaseCaption(document, sectionTarget) || "Untitled";
    // TODO: Disable publish button while publishing
    db.publishDocumentAsSupport(document, audience, sectionTarget, caption)
      .then(() => ui.alert("Your support was published.", "Support Published"));
  }

  private handlePublishDocument = (document: DocumentModelType) => {
    const { appConfig, db, ui } = this.stores;
    const docTypeString = document.getLabel(appConfig, 1);
    const docTypeStringL = document.getLabel(appConfig, 1, true);
    // TODO: Disable publish button while publishing
    const dbPublishDocumentFunc = document.type === ProblemDocument
                                    ? db.publishProblemDocument
                                    : db.publishOtherDocument;
    dbPublishDocumentFunc.call(db, document)
      .then(() => ui.alert(`Your ${docTypeStringL} was published.`, `${docTypeString} Published`));
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
