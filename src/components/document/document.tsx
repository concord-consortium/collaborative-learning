import { inject, observer } from "mobx-react";
import { autorun, IReactionDisposer, reaction } from "mobx";
import React from "react";
import FileSaver from "file-saver";
import { kAnalyzerUserParams } from "../../../shared/shared";
import { Logger } from "../../lib/logger";
import { LogEventName } from "../../lib/logger-types";
import { DocumentModelType } from "../../models/document/document";
import { CommentWithId } from "../../models/document/document-comments-manager";
import { LearningLogDocument, LearningLogPublication } from "../../models/document/document-types";
import { getDocumentTitleWithTimestamp } from "../../models/document/document-utils";
import { logDocumentEvent, logDocumentViewEvent } from "../../models/document/log-document-event";
import { IToolbarModel } from "../../models/stores/problem-configuration";
import { SupportType, TeacherSupportModelType, AudienceEnum } from "../../models/stores/supports";
import { WorkspaceModelType } from "../../models/stores/workspace";
import { ENavTab } from "../../models/view/nav-tabs";
import { translate } from "../../utilities/translation/translate";
import { BaseComponent, IBaseProps } from "../base";
import { IconButton } from "../utilities/icon-button";
import ToggleControl from "../utilities/toggle-control";
import { DocumentAnnotationToolbar } from "./document-annotation-toolbar";
import { DocumentFileMenu } from "./document-file-menu";
import { MyWorkDocumentOrBrowser } from "./mywork-document-or-browser";

import IdeaIcon from "../../assets/idea-icon.svg";

import "./document.scss";

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
  toolbar?: IToolbarModel;
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

const EditButton = ({ onClick }: { onClick: () => void }) => {
  return (
    <IconButton icon="edit" key="edit" className="action icon-edit"
                onClickButton={onClick} title={`Rename ${translate("Workspace")}`} />
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
  const groupTerm = translate("studentGroup");
  const titlePrefix = isShared ? "Shared: click to unshare from" : "Unshared: click to share to";
  const title = `${titlePrefix} ${groupTerm.toLowerCase()}`;
  return (
    <>
      {<div className="share-separator" />}
      <ToggleControl className={`share-button ${visibility}`} dataTest="share-button"
                      value={isShared} onChange={onClick}
                      title={title} />
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

const IdeasButton = ({ onClick }: { onClick: () => void }) => {
  return (
    <button
      title={"Request Idea"}
      onClick={onClick}
      className="ideas-button"
      data-test="ideas-button"
    >
      <IdeaIcon/>
      Ideas?
    </button>
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
      () => this.stores.persistentUI.problemWorkspace.primaryDocumentKey,
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

    // set learning log class for styling the toolbar separator
    const sectionClass = document.type === "learningLog" ? "learning-log" : "";

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
          readOnly={readOnly}
          sectionClass={sectionClass}
        />
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
          const { persistentUI: { problemWorkspace } } = stores;
          problemWorkspace.toggleComparisonVisible({ override: false, muteLog: true });
        }
      });
    }
  }

  private showFileMenu() {
    const { appConfig: { aiEvaluation, navTabs }, documents } = this.stores;
    const hasIdeas = aiEvaluation || documents.invisibleExemplarDocuments.length > 0;
    // Show the File menu if my work navigation is enabled, or if we have Ideas since in that
    // case students may need to make more documents and publishing should be available
    // independently of showing a MyWork tab.
    return !!navTabs.getNavTabSpec(ENavTab.kMyWork) || hasIdeas;
  }

  private showPersonalShareToggle() {
    const tabNames = this.stores.appConfig.navTabs.tabSpecs.map(tab => tab.tab);
    return tabNames.includes(ENavTab.kSortWork);
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
    const { problem, appConfig, appMode, clipboard, user: { isTeacherOrResearcher } } = this.stores;
    const problemTitle = problem.title;
    const { document, workspace } = this.props;
    const isShared = document.visibility === "public";
    const showShareButton = type !== "planning";
    const showFileMenu = this.showFileMenu();
    const show4up = !appConfig.hide4up && !workspace.comparisonVisible && !isTeacherOrResearcher;
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
            <DocumentAnnotationToolbar />
            {this.renderIdeasButton()}
          </div>
        }
        <div className="title" data-test="document-title">
          {`${problemTitle}${type === "planning" ? ": Planning" : ""}`} {this.renderStickyNotes()}
        </div>
        {!hideButtons &&
          <div className="actions right" data-test="document-titlebar-actions">
            {downloadButton}
            {show4up && this.renderMode()}
            {showShareButton &&
              <ShareButton isShared={isShared} onClick={this.handleToggleVisibility} />}
          </div>
        }
      </div>
    );
  }

  private getStickyNoteData() {
    if (!this.isPrimary()) {
      return {stickyNotes: [], hasNotes: false, showNotes: false};
    }
    const { user, supports } = this.stores;
    const { stickyNotesVisible } = this.state;

    const stickyNotes = supports.getStickyNotesForUserProblem({
      userId: user.id,
      groupId: user.currentGroupId
    }).filter((support) => support.supportType === SupportType.teacher).filter((tSupport) => {
      // NOTE: at one point exemplar documents were being added as supports for the wrong problems in the DB
      // this is a fix to prevent showing sticky notes that are not for the current problem
      if (tSupport.support.linkedDocumentKey) {
        // check that the linked document is for the current problem
        return !!this.stores.documents.getDocument(tSupport.support.linkedDocumentKey);
      } else {
        return true;
      }
    }) as TeacherSupportModelType[];
    stickyNotes.sort((a, b) => b.authoredTime - a.authoredTime);

    const hasNotes = stickyNotes.length > 0;
    const hasNewStickyNotes = supports.hasNewStickyNotes(user.lastStickyNoteViewTimestamp);
    const showNotes = hasNotes && (stickyNotesVisible || hasNewStickyNotes);
    return {stickyNotes, hasNotes, showNotes, hasNewStickyNotes};
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

  private renderIdeasButton() {
    const { documents, appConfig: { aiEvaluation, showIdeasButton } } = this.stores;
    // if showIdeasButton is explicitly set in the unit config, use that, otherwise
    // show the button if aiEvaluation is enabled or if there are exemplar documents
    const showButton = showIdeasButton !== undefined
      ? showIdeasButton
      : aiEvaluation || documents.invisibleExemplarDocuments.length > 0;
    if (showButton) {
      return (
        <IdeasButton onClick={this.handleIdeasButtonClick} />
      );
    }
  }

  private openDocument(key: string) {
    const { appConfig, documents, persistentUI, sortedDocuments, user } = this.stores;
    const doc = documents.getDocument(key);
    if (doc) {
      persistentUI.openResourceDocument(doc, appConfig, user, sortedDocuments);
      logDocumentViewEvent(doc);
    }
  }

  private renderDocumentLink(key: string|undefined) {
    if (!key) return null;
    const title = this.stores.documents.getDocument(key)?.title;
    if (title) {
      return (<a onClick={() => this.openDocument(key)} href="#">{title}</a>);
    } else {
      return "[broken link!]";
    }
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
              ? `${translate("studentGroup")} ${audience.identifier}`
              : user.name;
            const authoredTimeAsDate = new Date(authoredTime);
            const sentOn = `${authoredTimeAsDate.toLocaleDateString()}, ${authoredTimeAsDate.toLocaleTimeString()}`;
            // console.log("support", support);
            return (
              <div key={index} className={`sticky-note-popup-item ${index > 0 ? "border-top" : ""} `}>
                <div className="sticky-note-popup-item-meta">
                  Sent to: {sentTo}, {sentOn}
                </div>
                <div className="sticky-note-popup-item-content">
                  {support.content}
                  { ' ' }
                  { this.renderDocumentLink(support.linkedDocumentKey) }
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
    const modeTitle = workspace.mode === "1-up"
      ? `Join ${translate("studentGroup")} View`
      : "Return to Student View";
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
    const showPersonalShareToggle = this.showPersonalShareToggle();
    return (
      <div className={`titlebar ${type}`}>
        <div className="actions">
          { !hideButtons && showFileMenu &&
              <DocumentFileMenu document={document}
                onOpenDocument={this.handleOpenDocumentClick}
                onCopyDocument={this.handleCopyDocumentClick}
                isDeleteDisabled={countNotDeleted < 1}
                onDeleteDocument={this.handleDeleteDocumentClick}
                onAdminDestroyDocument={this.handleAdminDestroyDocument} />
          }
          <DocumentAnnotationToolbar />
          {this.renderIdeasButton()}
        </div>
        {hasDisplayId && <div className="display-id" style={{opacity: 0}}>{displayId}</div>}
        {
          document.type === LearningLogDocument || document.type === LearningLogPublication
          ? <div className="title" data-test="learning-log-title">
              <TitleInfo docTitle={`Learning Log: ${document.title}`} onClick={this.handleDocumentRename} />
              { !hideButtons && <EditButton onClick={this.handleDocumentRename} /> }
              {this.renderStickyNotes()}
            </div>
          : <div className="title" data-test="personal-doc-title">
              <TitleInfo
                docTitle={`${getDocumentTitleWithTimestamp(document, appConfig)}`}
                onClick={this.handleDocumentRename} />
              { !hideButtons && <EditButton onClick={this.handleDocumentRename} /> }
              {this.renderStickyNotes()}
            </div>
        }
        {hasDisplayId && <div className="display-id">{displayId}</div>}
        <div className="actions">
          {(!hideButtons || supportStackedTwoUpView) &&
            <div className="actions">
              {showPersonalShareToggle &&
                <ShareButton isShared={document.visibility === "public"} onClick={this.handleToggleVisibility} />}
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

  // The "ideas" button does either or both of two things, depending on the unit configuration:
  // shows an exemplar, and/or triggers AI evaluation.
  // The exemplar controller listens to log messages and then decides when to reveal an exemplar
  // based on rules defined in exemplar-controller-rules. So we just
  // need to log the click. See: exemplar-controller.ts, and exemplar-controller-rules.ts
  // The AI evaluation is triggered by updating the last-edited timestamp.
  private handleIdeasButtonClick = async () => {
    const { document } = this.props;
    const { db: { firebase }, user, ui, persistentUI, appConfig } = this.stores;

    await firebase.setLastEditedNow(user, document.key, document.uid);

    // Unselect all tiles, so that the whole-document comments are shown
    ui.clearSelectedTiles();
    persistentUI.openResourceDocument(document, appConfig, user, this.stores.sortedDocuments);
    persistentUI.toggleShowChatPanel(true);

    if (appConfig.aiEvaluation) {
      if (document.commentsManager) {
        // Use the comments manager to queue a pending AI comment.
        // The manager will automatically check when new comments arrive
        // and remove this pending item when AI analysis completes.
        const docLastEditedTime = await firebase.getLastEditedTimestamp(user, document.key);
        const effectiveLastEdited = docLastEditedTime || Date.now();

        document.commentsManager.queueRemoteComment({
          triggeredAt: effectiveLastEdited,
          source: "ai",
          checkCompleted: (comments: CommentWithId[]) => {
            // Check if AI analysis is complete by finding an AI comment
            // that was created after the document was last edited.
            const lastAIComment = [...comments]
              .reverse()
              .find(comment => comment.uid === kAnalyzerUserParams.id);

            return !!(lastAIComment &&
                     lastAIComment.createdAt.getTime() > effectiveLastEdited);
          }
        });
      }
    }

    logDocumentEvent(LogEventName.REQUEST_IDEA, { document });
  };

  private handleToggleWorkspaceMode = () => {
    this.props.workspace.toggleMode();
  };

  private handleToggleVisibility = () => {
    const document = this.props.document;
    document.toggleVisibility();
    logDocumentEvent(LogEventName.SHOW_WORK, { document });
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
    const { appConfig, persistentUI } = this.stores;
    persistentUI.rightNavDocumentSelected(appConfig, document);
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
