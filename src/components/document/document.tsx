import { inject, observer } from "mobx-react";
import { autorun, IReactionDisposer, reaction } from "mobx";
import React from "react";
import FileSaver from "file-saver";
import { usePublishDialog } from "./use-publish-dialog";
import { DocumentFileMenu } from "./document-file-menu";
import { MyWorkDocumentOrBrowser } from "./document-or-browser";
import { BaseComponent, IBaseProps } from "../base";
import { DocumentModelType } from "../../models/document/document";
import { LearningLogDocument, LearningLogPublication } from "../../models/document/document-types";
import { ToolbarModelType } from "../../models/stores/problem-configuration";
import { SupportType, TeacherSupportModelType, AudienceEnum } from "../../models/stores/supports";
import { WorkspaceModelType } from "../../models/stores/workspace";
import { ENavTab } from "../../models/view/nav-tabs";
import { IconButton } from "../utilities/icon-button";
import ToggleControl from "../utilities/toggle-control";
import { Logger, LogEventName } from "../../lib/logger";

import "./document.sass";

export enum DocumentViewMode {
  Live,
  Published
}

export type WorkspaceSide = "primary" | "comparison";

interface IProps extends IBaseProps {
  workspace: WorkspaceModelType;
  document: DocumentModelType;
  onNewDocument?: (type: string) => void;
  onCopyDocument?: (document: DocumentModelType) => void;
  onDeleteDocument?: (document: DocumentModelType) => void;
  onAdminDestroyDocument?: (document: DocumentModelType) => void;
  toolbar?: ToolbarModelType;
  side: WorkspaceSide;
  readOnly?: boolean;
}

interface IState {
  showBrowser: boolean;
  stickyNotesVisible: boolean;
}

type SVGClickHandler = (e: React.MouseEvent<SVGSVGElement>) => void;

const DownloadButton = ({ onClick }: { onClick: SVGClickHandler }) => {
  return (
    <svg className={`action icon icon-download`} onClick={onClick}>
      <use xlinkHref={`#icon-publish`} />
    </svg>
  );
};

const PublishButton = ({ document }: { document: DocumentModelType }) => {
  const [showPublishDialog] = usePublishDialog(document);
  const handlePublishButtonClick = () => {
    showPublishDialog();
  };
  return (
    <IconButton icon="publish" key="publish" className="action icon-publish" dataTestName="publish-icon"
                onClickButton={handlePublishButtonClick} title="Publish Workspace" />
  );
};

const EditButton = ({ onClick }: { onClick: () => void }) => {
  return (
    <IconButton icon="edit" key="edit" className="action icon-edit"
                onClickButton={onClick} title="Rename Workspace" />
  );
};

const OneUpButton = ({ onClick, selected }: { onClick: () => void, selected: boolean }) => {
  const selectedClass = selected ? "selected" : "";
  return (
    <IconButton icon="one-up" key="one-up" className={"action icon-one-up"}
                innerClassName={selectedClass}
                onClickButton={onClick} title="One-Up View" />
  );
};

const TwoUpStackedButton = ({ onClick, selected }: { onClick: () => void, selected: boolean }) => {
  const selectedClass = selected ? "selected" : "";
  return (
    <IconButton icon="two-up-stacked" key="two-up-stacked" className={"action icon-two-up-stacked"}
                innerClassName={selectedClass}
                onClickButton={onClick} title="Two-Up View" />
  );
};

const ShareButton = ({ onClick, isShared }: { onClick: () => void, isShared: boolean }) => {
  const visibility = isShared ? "public" : "private";
  return (
    <>
      {<div className="share-separator" />}
      <ToggleControl className={`share-button ${visibility}`} dataTest="share-button"
                      initialValue={isShared} onChange={onClick}
                      title={`${isShared ? "Shared: click to unshare from" : "Unshared: click to share to"} group`} />
      <div className="share-label">Share</div>
    </>
  );
};

const ViewModeButton = ({ onClick, icon, title }: { onClick: () => void, icon: string, title: string }) => {
  return (
    <IconButton icon={icon} key={icon} className={`action mode icon-${icon}`}
                innerClassName={`${icon}`} onClickButton={onClick}
                title={title} />
  );
};

const TitleInfo = ({ docTitle, onClick }: { docTitle: string, onClick?: () => void }) => {
  return (
    <span onClick={onClick} className="title-info" id="titlebar-title">
      {docTitle}
    </span>
  );
};

const StickyNoteButton = ({ onClick }: { onClick: () => void }) => {
  return (
    <IconButton icon="sticky-note" key="sticky-note" className="action icon-sticky-note"
                onClickButton={onClick} title="View Notes" />
  );
};

@inject("stores")
@observer
export class DocumentComponent extends BaseComponent<IProps, IState> {

  private stickyNoteIcon: HTMLDivElement | null;
  private documentContainer: HTMLDivElement | null;
  private openHandlerDisposer: IReactionDisposer;
  private deleteHandler: { documentKey?: string, disposer?: IReactionDisposer } = {};

  state = {
    showBrowser: false,
    stickyNotesVisible: false
  };

  public componentDidMount() {
    this.configureDeleteHandler();
  }

  public componentDidUpdate() {
    this.openHandlerDisposer = reaction(
      // data function: changes to primaryDocumentKey trigger the reaction
      () => this.stores.ui.problemWorkspace.primaryDocumentKey,
      // reaction function
      () => this.setState({ showBrowser: false })
    );
    this.configureDeleteHandler();
  }

  public componentWillUnmount() {
    this.deleteHandler.disposer?.();
    this.openHandlerDisposer?.();
  }

  public render() {
    const { workspace, document, toolbar, side, readOnly } = this.props;
    return (
      <div key="document" className="document" ref={(el) => this.documentContainer = el}>
        {this.renderTitleBar(document.type)}
        <MyWorkDocumentOrBrowser
          showBrowser={this.state.showBrowser}
          onSelectNewDocument={this.handleSelectNewDocument}
          onSelectDocument={this.handleSelectDocument}
          mode={workspace.mode}
          isPrimary={side === "primary"}
          document={document}
          toolbar={toolbar}
          readOnly={readOnly} />
        {this.renderStickyNotesPopup()}
      </div>
    );
  }

  private configureDeleteHandler() {
    const { deleteHandler, props: { document, side }, stores } = this;
    if (document.key !== deleteHandler.documentKey) {
      // dispose any previous delete handler
      deleteHandler.disposer?.();
      // install delete handler for current document
      deleteHandler.disposer = autorun(() => {
        const isDeleted = document.getProperty("isDeleted");
        // close comparison when comparison document is deleted
        if (isDeleted && (side === "comparison")) {
          const { ui: { problemWorkspace } } = stores;
          problemWorkspace.toggleComparisonVisible({ override: false, muteLog: true });
        }
      });
    }
  }

  private showFileMenu() {
    const { appConfig: { navTabs } } = this.stores;
    // show the File menu if my work navigation is enabled
    return !!navTabs.getNavTabSpec(ENavTab.kMyWork);
  }

  private renderTitleBar(type: string) {
    const { document, side } = this.props;
    const hideButtons = (side === "comparison") || document.isPublished;
    if (document.isProblem || document.isPlanning) {
      return this.renderProblemTitleBar(type, hideButtons);
    }
    if (document.isPersonal || document.isLearningLog) {
      return this.renderOtherDocumentTitleBar(type, hideButtons);
    }
    if (document.isSupport) {
      return this.renderSupportTitleBar(type);
    }
  }

  private renderProblemTitleBar(type: string, hideButtons?: boolean) {
    const {problem, appMode, clipboard, user: { isTeacher }} = this.stores;
    const problemTitle = problem.title;
    // console.log("problemTitle:", problemTitle);
    const { document, workspace } = this.props;
    const isShared = document.visibility === "public";
    const showFileMenu = this.showFileMenu();
    const show4up = !workspace.comparisonVisible && !isTeacher;
    const downloadButton = (appMode !== "authed") && clipboard.hasJsonTileContent()
                            ? <DownloadButton key="download" onClick={this.handleDownloadTileJson} />
                            : undefined;
    return (
      <div className={`titlebar ${type}`}>
        {!hideButtons &&
          <div className="actions left">
            {showFileMenu &&
              <DocumentFileMenu document={document}
                onOpenDocument={this.handleOpenDocumentClick}
                onCopyDocument={this.handleCopyDocumentClick}
                isDeleteDisabled={true}
                onAdminDestroyDocument={this.handleAdminDestroyDocument} />}
            {this.showPublishButton(document) &&
              <PublishButton document={document} />}
          </div>
        }
        <div className="title" data-test="document-title">
          {`${problemTitle}${type === "planning" ? ": Planning" : ""}`} {this.renderStickyNotes()}
        </div>
        {!hideButtons &&
          <div className="actions right" data-test="document-titlebar-actions">
            {downloadButton}
            {show4up && this.renderMode()}
            {!isTeacher &&
              <ShareButton isShared={isShared} onClick={this.handleToggleVisibility} />}
          </div>
        }
      </div>
    );
  }

  private showPublishButton(document: DocumentModelType) {
    const { appConfig } = this.stores;
    if (!appConfig.disablePublish) return true;
    // When we disable publishing by setting disablePublish=true,
    // we set showPublishButton to false to hide the Publish button
    if (document.type === "planning" || appConfig.disablePublish === true) return false;
    return appConfig.disablePublish
            .findIndex(spec => {
              return (document.type === spec.documentType) &&
                      document.matchProperties(spec.properties);
            }) < 0;
  }

  private getStickyNoteData() {
    if (!this.isPrimary()) {
      return {stickyNotes: [], hasNotes: false, showNotes: false};
    }
    const { user, supports } = this.stores;
    const { stickyNotesVisible } = this.state;

    const stickyNotes = supports.getStickyNotesForUserProblem({
      userId: user.id,
      groupId: user.latestGroupId
    }).filter((support) => support.supportType === SupportType.teacher) as TeacherSupportModelType[];
    stickyNotes.sort((a, b) => b.authoredTime - a.authoredTime);

    const hasNotes = stickyNotes.length > 0;
    const hasNewStickyNotes = supports.hasNewStickyNotes(user.lastStickyNoteViewTimestamp);
    const showNotes = hasNotes && (stickyNotesVisible || hasNewStickyNotes);
    return {stickyNotes, hasNotes, showNotes};
  }

  private renderStickyNotes() {
    const {hasNotes, showNotes} = this.getStickyNoteData();
    if (!hasNotes) {
      return;
    }
    const onClick = showNotes ? this.handleViewStickyNoteClose : this.handleViewStickyNoteOpen;
    return (
      <div ref={(el) => this.stickyNoteIcon = el}>
        <StickyNoteButton onClick={onClick} />
      </div>
    );
  }

  private renderStickyNotesPopup() {
    const { user } = this.stores;
    const { stickyNotes, showNotes} = this.getStickyNoteData();
    if (!showNotes || !this.stickyNoteIcon || !this.documentContainer) {
      return;
    }
    const title = stickyNotes.length === 1 ? "Note" : "Notes";
    const documentRect = this.documentContainer.getBoundingClientRect();
    const iconRect = this.stickyNoteIcon.getBoundingClientRect();
    const maxWidth = 350;
    const top = 55;
    const left = (iconRect.left - documentRect.left) - (maxWidth / 2);
    return (
      <div className="sticky-note-popup" style={{top, left, maxWidth}}>
        <div className="sticky-note-popup-titlebar">
          <div className="sticky-note-popup-titlebar-title" >{title}</div>
          <div className="sticky-note-popup-titlebar-close-icon" onClick={this.handleViewStickyNoteClose} />
        </div>
        <div className="sticky-note-popup-items">
          {stickyNotes.map((teacherSupport, index) => {
            const { support, audience, authoredTime } = teacherSupport;
            const sentTo = audience.type === AudienceEnum.group
              ? `Group ${audience.identifier}`
              : user.name;
            const authoredTimeAsDate = new Date(authoredTime);
            const sentOn = `${authoredTimeAsDate.toLocaleDateString()}, ${authoredTimeAsDate.toLocaleTimeString()}`;
            return (
              <div key={index} className={`sticky-note-popup-item ${index > 0 ? "border-top" : ""} `}>
                <div className="sticky-note-popup-item-meta">
                  Sent to: {sentTo}, {sentOn}
                </div>
                <div className="sticky-note-popup-item-content">
                  {support.content}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  private renderMode() {
    const {workspace} = this.props;
    const mode = workspace.mode === "1-up" ? "up1" : "up4";
    const modeTitle = workspace.mode === "1-up" ? "Join Group View" : "Return to Student View";
    return (
      <ViewModeButton onClick={this.handleToggleWorkspaceMode} icon={mode} title={modeTitle} />
    );
  }

  private renderOtherDocumentTitleBar(type: string, hideButtons?: boolean) {
    const { document, workspace } = this.props;
    const { appConfig, user, documents } = this.stores;
    const otherDocuments = documents.byTypeForUser(document.type, user.id);
    const countNotDeleted = otherDocuments.reduce((prev, doc) => doc.getProperty("isDeleted") ? prev : prev + 1, 0);
    const { supportStackedTwoUpView } = appConfig;
    const isPrimary = this.isPrimary();
    const displayId = document.getDisplayId(appConfig);
    const hasDisplayId = !!displayId;
    const showFileMenu = this.showFileMenu();
    return (
      <div className={`titlebar ${type}`}>
        {!hideButtons &&
          <div className="actions">
            { showFileMenu &&
              <DocumentFileMenu document={document}
                onOpenDocument={this.handleOpenDocumentClick}
                onCopyDocument={this.handleCopyDocumentClick}
                isDeleteDisabled={countNotDeleted < 1}
                onDeleteDocument={this.handleDeleteDocumentClick}
                onAdminDestroyDocument={this.handleAdminDestroyDocument} /> }
            {this.showPublishButton(document) &&
              <PublishButton document={document} />}
          </div>
        }
        {hasDisplayId && <div className="display-id" style={{opacity: 0}}>{displayId}</div>}
        {
          document.type === LearningLogDocument || document.type === LearningLogPublication
          ? <div className="title" data-test="learning-log-title">
              <TitleInfo docTitle={`Learning Log: ${document.title}`} onClick={this.handleDocumentRename} />
              { !hideButtons && <EditButton onClick={this.handleDocumentRename} /> }
            </div>
          : <div className="title" data-test="personal-doc-title">
              <TitleInfo docTitle={`${document.getDisplayTitle(appConfig)}`} onClick={this.handleDocumentRename} />
              { !hideButtons && <EditButton onClick={this.handleDocumentRename} /> }
            </div>
        }
        {hasDisplayId && <div className="display-id">{displayId}</div>}
        <div className="actions">
          {(!hideButtons || supportStackedTwoUpView) &&
            <div className="actions">
              {supportStackedTwoUpView && isPrimary &&
                <OneUpButton onClick={this.handleHideTwoUp} selected={!workspace.comparisonVisible} />}
              {supportStackedTwoUpView && isPrimary &&
                <TwoUpStackedButton onClick={this.handleShowTwoUp} selected={workspace.comparisonVisible} />}
            </div>
          }
        </div>
      </div>
    );
  }

  private renderSupportTitleBar(type: string) {
    const { document } = this.props;
    return (
      <div className={`titlebar ${type}`}>
        <div className="title" data-test="document-title">
          {document.getProperty("caption")}
        </div>
      </div>
    );
  }

  private handleToggleWorkspaceMode = () => {
    this.props.workspace.toggleMode();
  };

  private handleToggleVisibility = () => {
    const doc = this.props.document;
    doc.toggleVisibility();
    Logger.logDocumentEvent(LogEventName.SHOW_WORK, doc);
  };

  private handleShowTwoUp = () => {
    this.props.workspace.toggleComparisonVisible({override: true});
  };
  private handleHideTwoUp = () => {
    this.props.workspace.toggleComparisonVisible({override: false});
  };

  private handleDownloadTileJson = () => {
    const { clipboard } = this.stores;
    const tileJson = clipboard.getJsonTileContent();
    if (tileJson) {
      const blobJson = new Blob([tileJson], {type: "text/plain;charset=utf-8"});
      FileSaver.saveAs(blobJson, "tile-content.json");
    }
    clipboard.clear();
  };

  private handleSelectNewDocument = (type: string) => {
    const { onNewDocument } = this.props;
    onNewDocument?.(type);
  };

  private handleOpenDocumentClick = () => {
    this.setState({ showBrowser: true });
  };

  private handleCopyDocumentClick = () => {
    const { document, onCopyDocument } = this.props;
    onCopyDocument?.(document);
  };

  private handleDeleteDocumentClick = () => {
    const { document, onDeleteDocument } = this.props;
    onDeleteDocument?.(document);
  };

  private handleAdminDestroyDocument = () => {
    const { document, onAdminDestroyDocument } = this.props;
    onAdminDestroyDocument?.(document);
  };

  private handleSelectDocument = (document: DocumentModelType) => {
    const { appConfig, ui } = this.stores;
    ui.rightNavDocumentSelected(appConfig, document);
    this.setState({ showBrowser: false });
  };

  private handleDocumentRename = () => {
    const { document } = this.props;
    const { appConfig } = this.stores;
    const docTypeString = document.getLabel(appConfig, 1);
    const docTypeStringL = document.getLabel(appConfig, 1, true);
    this.stores.ui.prompt(`Rename your ${docTypeStringL}:`, document.title, `Rename ${docTypeString}`)
      .then((title: string) => {
        if (title !== document.title) {
          document.setTitle(title);
        }
      });
  };

  private isPrimary() {
    return this.props.side === "primary";
  }

  private setStickyNotesVisible = (stickyNotesVisible: boolean) => {
    this.setState({stickyNotesVisible});
    this.stores.db.setLastStickyNoteViewTimestamp();
  };

  // can't use single toggle handler here as the visibility state also depends on
  // new supports automatically making the notes show
  private handleViewStickyNoteOpen = () => {
    Logger.log(LogEventName.OPEN_STICKY_NOTES);
    this.setStickyNotesVisible(true);
  };
  private handleViewStickyNoteClose = () => {
    Logger.log(LogEventName.CLOSE_STICKY_NOTES);
    this.setStickyNotesVisible(false);
  };

}
