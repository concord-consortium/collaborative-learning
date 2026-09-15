import { comparer, reaction, IReactionDisposer } from "mobx";
import { inject, observer } from "mobx-react";
import React from "react";
import { BaseComponent, IBaseProps } from "../../components/base";
import { DocumentComponent, WorkspaceSide } from "../../components/document/document";
import { GroupVirtualDocumentComponent } from "../../components/document/group-virtual-document";
import { DocumentModelType } from "../../models/document/document";
import { hasGroupOwner } from "../../models/document/document-axes";
import { DocumentContentModel, DocumentContentModelType } from "../../models/document/document-content";
import {
  DocumentDragKey, isAxesType, LearningLogDocument, OtherDocumentType, PersonalDocument, ProblemDocument
} from "../../models/document/document-types";
import { createDefaultSectionedContent } from "../../models/document/sectioned-content";
import { kImageTileType } from "../../models/tiles/image/image-content";
import {
  removeLoadingMessage, showLoadingMessage, logLoadingAndDocumentMeasurements
} from "../../utilities/loading-utils";
import { translate } from "../../utilities/translation/translate";
import { ImageDragDrop } from "../utilities/image-drag-drop";

import "./document-workspace.scss";

interface IProps extends IBaseProps {
}


@inject("stores")
@observer
export class DocumentWorkspaceComponent extends BaseComponent<IProps> {
  private imageDragDrop: ImageDragDrop;
  private primaryDocument?: DocumentModelType;
  private primaryDocumentLoaded = false;
  private groupChangeDisposer?: IReactionDisposer;
  private unmounted = false;

  constructor(props: IProps) {
    super(props);

    showLoadingMessage(`Building ${translate("workspace")}`);
    this.imageDragDrop = new ImageDragDrop({
      isAcceptableImageDrag: this.isAcceptableImageDrag
    });
  }

  public componentDidMount() {
    this.guaranteeInitialDocuments();

    // Keep the primary document in step with the user's group. Watching the primary's group id
    // alongside the user's current group id covers the persisted primary loading before or after
    // currentGroupId resolves, and a group switch mid-session; firing immediately covers the first
    // visit, when no primary is set yet. Skipping when currentGroupId is undefined avoids closing
    // anything during bootstrap before the groups listener has set the user's group. A primary that
    // is not a group document is left alone: the last-opened document is restored as usual.
    this.groupChangeDisposer = reaction(
      () => {
        const { persistentUI: { problemWorkspace }, user } = this.stores;
        const primary = this.getPrimaryDocument(problemWorkspace.primaryDocumentKey);
        return {
          hasPrimary: !!problemWorkspace.primaryDocumentKey,
          primaryDocGroupId: primary && hasGroupOwner(primary) ? primary.groupId : undefined,
          currentGroupId: user.currentGroupId,
        };
      },
      ({ hasPrimary, primaryDocGroupId, currentGroupId }) => {
        if (!currentGroupId) return;
        if (!hasPrimary) {
          // Nothing to show yet. When the unit starts students in their group's document, open it;
          // otherwise guaranteeInitialDocuments opens the default document.
          if (this.startsInGroupDocumentAsStudent) {
            this.openGroupPrimaryDocument(currentGroupId);
          }
          return;
        }
        if (!primaryDocGroupId || primaryDocGroupId === currentGroupId) return;
        // The primary is another group's document. Follow the student to their new group's document
        // when the unit starts them there; otherwise fall back to the default document.
        if (this.startsInGroupDocumentAsStudent) {
          this.openGroupPrimaryDocument(currentGroupId);
        } else {
          this.openDefaultPrimaryDocument();
        }
      },
      { equals: comparer.shallow, fireImmediately: true }
    );
  }

  public componentWillUnmount() {
    this.unmounted = true;
    this.groupChangeDisposer?.();
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
        removeLoadingMessage(`Building ${translate("workspace")}`);
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
    const { appConfig: { defaultDocumentType, defaultDocumentTemplate, defaultDocumentTemplateEnabled } }
      = this.stores;
    // "group" has no default-content spec; degrade to the problem document.
    const type = defaultDocumentType === "group" ? ProblemDocument : defaultDocumentType;
    // Apply the template unless it has been explicitly switched off (undefined/legacy → apply).
    const template = defaultDocumentTemplateEnabled !== false ? defaultDocumentTemplate : undefined;
    return { type, content: DocumentContentModel.create(template) };
  }

  private getDefaultSectionedDocumentContent(defaultType: string, defaultContent?: DocumentContentModelType) {
    const { appConfig: { autoSectionProblemDocuments }, problem } = this.stores;
    // A non-empty document template provides its own content (and its own sections via dividers), so use it
    // for the problem document instead of the empty auto-sectioned default. getDefaultDocumentContentSpec
    // already yields empty content when the template is absent or switched off, so this covers those cases.
    const hasTemplateContent = !!defaultContent && !defaultContent.isEmpty;
    if ((defaultType === ProblemDocument) && autoSectionProblemDocuments && !hasTemplateContent) {
      // for problem documents, default content is a section header row and a placeholder tile
      // for each section that is present in the corresponding problem content
      return createDefaultSectionedContent({ sections: problem.sections });
    }
    return defaultContent;
  }

  private get startsInGroupDocumentAsStudent() {
    return this.stores.appConfig.startsInGroupDocument && this.stores.user.isStudent;
  }

  // Guarantees (opening if needed) the unit's default document without making it the workspace primary.
  private async guaranteeDefaultDocument() {
    const { db, sectionsLoadedPromise } = this.stores;
    const { type, content } = this.getDefaultDocumentContentSpec();
    await sectionsLoadedPromise;
    const documentContent = this.getDefaultSectionedDocumentContent(type, content);
    return db.guaranteeOpenDefaultDocument(type, documentContent);
  }

  private async openDefaultPrimaryDocument() {
    const defaultDocument = await this.guaranteeDefaultDocument();
    if (defaultDocument) {
      this.stores.persistentUI.problemWorkspace.setPrimaryDocument(defaultDocument);
    }
  }

  // Opens the given group's document as the primary. Called from the group-change reaction, which fires
  // again if membership moves while the resolve is in flight, so a result for a group the student has
  // since left is simply dropped. app.tsx only mounts the workspace once a student is in a group, so the
  // group context db.requireGroupContext needs is already in place.
  private async openGroupPrimaryDocument(groupId: string): Promise<void> {
    const { db, persistentUI: { problemWorkspace }, user } = this.stores;
    const stale = () => this.unmounted || user.currentGroupId !== groupId;
    try {
      const groupDocument = await db.getOrCreateGroupDocument();
      if (stale()) return;
      if (!groupDocument) {
        throw new Error("getOrCreateGroupDocument returned no document");
      }
      problemWorkspace.setPrimaryDocument(groupDocument);
    } catch (err) {
      if (stale()) return;
      console.warn("Could not open the group document as the default; using the default document", err);
      // Only fall back while the workspace is still empty rather than replacing whatever is shown.
      if (!problemWorkspace.primaryDocumentKey) {
        await this.openDefaultPrimaryDocument().catch((fallbackErr) => {
          console.error("Fallback to the default document also failed", fallbackErr);
        });
      }
    }
  }

  private async guaranteeInitialDocuments() {
    const { appConfig: { defaultLearningLogDocument, defaultLearningLogTitle, initialLearningLogTitle,
              groupDocumentsEnabled, classWideDocuments },
            db, persistentUI: { problemWorkspace },
            unit: { planningDocument }, user: { type: role } } = this.stores;
    if (!problemWorkspace.primaryDocumentKey) {
      if (this.startsInGroupDocumentAsStudent) {
        // The group-change reaction opens the group document as the primary. The student's own default
        // document is still guaranteed, without being shown — 4-up and publishing depend on it.
        const defaultDocument = await this.guaranteeDefaultDocument();
        if (!defaultDocument) {
          console.warn("Student's own default document was not created; 4-up and publishing need it");
        }
      } else {
        await this.openDefaultPrimaryDocument();
      }
    } else if (groupDocumentsEnabled || classWideDocuments?.length) {
      // Group documents and class-wide documents are both not loaded automatically like other
      // documents, so if the primary document is one of those, make sure it is opened properly.
      try {
        const primaryDocMetadata = await db.findFirestoreMetadata(problemWorkspace.primaryDocumentKey);
        if (primaryDocMetadata && isAxesType(primaryDocMetadata.type)) {
          db.openDocumentFromFirestoreMetadata(primaryDocMetadata);
        }
      } catch (e) {
        console.warn("Failed to check if primary document is a group document", e);
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
    const { db, persistentUI: { problemWorkspace }, ui } = this.stores;
    try {
      const groupDocument = await db.getOrCreateGroupDocument();

      if (groupDocument) {
        problemWorkspace.setPrimaryDocument(groupDocument);
      }
    } catch (error) {
      // Reached from an onClick with nothing awaiting it, so without this the user sees the click do
      // nothing at all. The sibling document-open handlers report the same way.
      ui.setError(error);
    }
  };

  private defaultOtherDocumentContent = (type: OtherDocumentType) => {
    const { appConfig: { defaultDocumentTemplate, defaultDocumentTemplateEnabled } } = this.stores;
    const templateEnabled = defaultDocumentTemplateEnabled !== false;
    const template = (type === PersonalDocument && templateEnabled) ? defaultDocumentTemplate : undefined;
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
        // Replace the now-tombstoned primary with the default doc.
        this.openDefaultPrimaryDocument();
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

  private getPrimaryDocument(documentKey?: string) {
    if (documentKey) {
      return this.stores.documents.getDocument(documentKey);
    }
  }
}
