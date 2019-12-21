import { inject, observer } from "mobx-react";
import * as React from "react";
import * as FileSaver from "file-saver";

import { CanvasComponent } from "./canvas";
import { DocumentContext, IDocumentContext } from "./document-context";
import { FourUpComponent } from "../four-up";
import { BaseComponent, IBaseProps } from "../base";
import { ToolbarComponent } from "../toolbar";
import { IToolApi, IToolApiInterface, IToolApiMap } from "../tools/tool-tile";
import { DocumentModelType, ISetProperties, LearningLogDocument, LearningLogPublication,
         ProblemDocument } from "../../models/document/document";
import { SupportType, TeacherSupportModelType, AudienceEnum } from "../../models/stores/supports";
import { WorkspaceModelType } from "../../models/stores/workspace";
import { TileCommentModel, TileCommentsModel } from "../../models/tools/tile-comments";
import { ToolbarConfig } from "../../models/tools/tool-types";
import { IconButton } from "../utilities/icon-button";
import SingleStringDialog from "../utilities/single-string-dialog";
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
  onNewDocument?: (document: DocumentModelType) => void;
  onCopyDocument?: (document: DocumentModelType) => void;
  onDeleteDocument?: (document: DocumentModelType) => void;
  onPublishSupport?: (document: DocumentModelType) => void;
  onPublishDocument?: (document: DocumentModelType) => void;
  toolbar?: ToolbarConfig;
  side: WorkspaceSide;
  readOnly?: boolean;
  isGhostUser?: boolean;
}

interface IState {
  documentContext?: IDocumentContext;
  isCommentDialogOpen: boolean;
  commentTileId: string;
  stickyNotesVisible: boolean;
}

type SVGClickHandler = (e: React.MouseEvent<SVGSVGElement>) => void;

const DownloadButton = ({ onClick }: { onClick: SVGClickHandler }) => {
  return (
    <svg key="download" className={`action icon icon-download`} onClick={onClick}>
      <use xlinkHref={`#icon-publish`} />
    </svg>
  );
};

const PublishButton = ({ onClick, dataTestName }: { onClick: () => void, dataTestName?: string }) => {
  return (
    <IconButton icon="publish" key="publish" className="action icon-publish" dataTestName={dataTestName}
                onClickButton={onClick} title="Publish Workspace" />
  );
};

const PublishedButton = ({ onClick, dataTestName }: { onClick: () => void, dataTestName?: string }) => {
  return (
    <IconButton icon="published" key="published" className="action icon-published" dataTestName={dataTestName}
                onClickButton={onClick} title="Published Workspace" />
  );
};

const PublishSupportButton = ({ onClick }: { onClick: () => void }) => {
  return (
    <IconButton icon="publish-support" key="support" className="action icon-support"
                onClickButton={onClick} title="publish to supports" />
  );
};

const NewButton = ({ onClick }: { onClick: () => void }) => {
  return (
    <IconButton icon="new" key="new" className="action icon-new"
                onClickButton={onClick} title="Create New Workspace" />
  );
};

const EditButton = ({ onClick }: { onClick: () => void }) => {
  return (
    <IconButton icon="edit" key="edit" className="action icon-edit"
                onClickButton={onClick} title="Rename Workspace" />
  );
};

const CopyButton = ({ onClick }: { onClick: () => void }) => {
  return (
    <IconButton icon="copy" key="copy" className="action icon-copy"
                onClickButton={onClick} title="Copy Workspace" />
  );
};

const DeleteButton = ({ onClick, enabled }: { onClick: () => void, enabled: boolean }) => {
    const enabledClass = enabled ? "enabled" : "disabled";
    return (
      <IconButton icon="delete" key={`delete-${enabledClass}`} className={`action icon-delete delete-${enabledClass}`}
                  enabled={enabled} innerClassName={enabledClass}
                  onClickButton={enabled ? onClick : undefined} title="Delete Workspace" />
    );
};

const ShareButton = ({ onClick, isShared }: { onClick: () => void, isShared: boolean }) => {
  const visibility = isShared ? "public" : "private";
  return (
    <IconButton icon="share" key={`share-${visibility}`} className={`action icon-share`}
                innerClassName={`visibility ${visibility}`} onClickButton={onClick}
                title={`${isShared ? "Unshare from" : "Share to"} Group`} />
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

  public static getDerivedStateFromProps: any = (nextProps: IProps, prevState: IState) => {
    const { document } = nextProps;
    const documentContext: IDocumentContext = {
            type: document.type,
            key: document.key,
            title: document.title,
            originDoc: document.originDoc,
            getProperty: (key: string) => document.properties.get(key),
            setProperties: (properties: ISetProperties) => document.setProperties(properties)
          };
    return document.key === prevState.documentContext?.key
            ? {}
            : { documentContext };
  }

  private toolApiMap: IToolApiMap = {};
  private toolApiInterface: IToolApiInterface;
  private stickyNoteIcon: HTMLDivElement | null;
  private documentContainer: HTMLDivElement | null;

  constructor(props: IProps) {
    super(props);

    this.toolApiInterface = {
      register: (id: string, toolApi: IToolApi) => {
        this.toolApiMap[id] = toolApi;
      },
      unregister: (id: string) => {
        delete this.toolApiMap[id];
      },
      getToolApi: (id: string) => {
        return this.toolApiMap[id];
      }
    };

    this.state = {
      isCommentDialogOpen: false,
      commentTileId: "",
      stickyNotesVisible: false
    };
  }

  public render() {
    const { document: { type } } = this.props;
    return (
      <DocumentContext.Provider value={this.state.documentContext}>
        {this.renderToolbar()}
        <div key="document" className="document" ref={(el) => this.documentContainer = el}>
          {this.renderTitleBar(type)}
          {this.renderCanvas()}
          {this.renderStatusBar(type)}
          {this.renderStickyNotesPopup()}
        </div>
      </DocumentContext.Provider>
    );
  }

  private renderTitleBar(type: string) {
    const { document, side, isGhostUser } = this.props;
    const hideButtons = isGhostUser || (side === "comparison") || document.isPublished;
    if (document.isProblem) {
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
    const {document, workspace} = this.props;
    const isShared = document.visibility === "public";
    const show4up = !workspace.comparisonVisible && !isTeacher;
    const downloadButton = (appMode !== "authed") && clipboard.hasJsonTileContent()
                            ? <DownloadButton key="download" onClick={this.handleDownloadTileJson} />
                            : undefined;
    return (
      <div className={`titlebar ${type}`}>
        {!hideButtons &&
          <div className="actions">
            <NewButton onClick={this.handleNewDocumentClick} />
            <CopyButton onClick={this.handleCopyDocumentClick} />
          </div>
        }
        <div className="title" data-test="document-title">
          {problemTitle} {this.renderStickyNotes()}
        </div>
        {!hideButtons &&
          <div className="actions" data-test="document-titlebar-actions">
            {[
              downloadButton,
              isTeacher &&
                <PublishSupportButton key="problemPublish" onClick={this.handlePublishSupport} />,
              this.showPublishButton(document) &&
                <PublishButton key="publish" onClick={this.handlePublishDocument} />,
              !isTeacher &&
                <ShareButton key="share" isShared={isShared} onClick={this.handleToggleVisibility} />
            ]}
            {show4up && this.renderMode()}
          </div>
        }
      </div>
    );
  }

  private showPublishButton(document: DocumentModelType) {
    const { appConfig } = this.stores;
    if (!appConfig.disablePublish) return true;
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
    const {document} = this.props;
    const { user: { isTeacher }, documents, user } = this.stores;
    const otherDocuments = documents.byTypeForUser(document.type, user.id);
    const countNotDeleted = otherDocuments.reduce((prev, doc) => doc.getProperty("isDeleted") ? prev : prev + 1, 0);
    return (
      <div className={`titlebar ${type}`}>
        {!hideButtons &&
          <div className="actions">
            <NewButton onClick={this.handleNewDocumentClick} />
            <CopyButton onClick={this.handleCopyDocumentClick} />
            <DeleteButton enabled={countNotDeleted > 1} onClick={this.handleDeleteDocumentClick} />
          </div>
        }
        {
          document.type === LearningLogDocument || document.type === LearningLogPublication
          ? <div className="title" data-test="learning-log-title">
              <TitleInfo docTitle={`Learning Log: ${document.title}`} onClick={this.handleDocumentRename} />
              { !hideButtons && <EditButton onClick={this.handleDocumentRename} /> }
            </div>
          : <div className="title" data-test="personal-doc-title">
              <TitleInfo docTitle={`${document.title}`} onClick={this.handleDocumentRename} />
              { !hideButtons && <EditButton onClick={this.handleDocumentRename} /> }
            </div>
        }
        <div className="actions">
          {!hideButtons && isTeacher && <PublishSupportButton key="otherDocPub" onClick={this.handlePublishSupport} />}
          {!hideButtons &&
            <div className="actions">
              {this.showPublishButton(document) &&
                <PublishButton dataTestName="other-doc-publish-icon" onClick={this.handlePublishDocument} />}
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

  private renderToolbar() {
    const {document, isGhostUser, readOnly} = this.props;
    const isPublication = document.isPublished;
    const showToolbar = this.isPrimary() && !isGhostUser && !readOnly && !isPublication;
    if (!showToolbar || !this.props.toolbar) return;
    return <ToolbarComponent key="toolbar" document={this.props.document}
                              config={this.props.toolbar} toolApiMap={this.toolApiMap} />;
  }

  private renderCanvas() {
    const { document, workspace, side, isGhostUser } = this.props;
    const fourUp = (document.type === ProblemDocument) &&
                    (isGhostUser || ((side === "primary") && (workspace.mode === "4-up")));
    const canvas = fourUp ? this.render4UpCanvas() : this.render1UpCanvas(document.isPublished);
    return (
      <div className="canvas-area">{canvas}</div>
    );
  }

  private render1UpCanvas(forceReadOnly?: boolean) {
    const readOnly = forceReadOnly || this.props.readOnly;
    return (
      <CanvasComponent context="1-up" document={this.props.document} readOnly={readOnly}
                        toolApiInterface={this.toolApiInterface} />
    );
  }

  private render4UpCanvas() {
    const {isGhostUser, document} = this.props;
    const { groups } = this.stores;
    const group = isGhostUser ? undefined : groups.groupForUser(document.uid);
    const groupId = isGhostUser ? groups.ghostGroupId : group && group.id;
    return (
      <FourUpComponent userId={document.uid} groupId={groupId} isGhostUser={isGhostUser}
                        toolApiInterface={this.toolApiInterface} />
    );
  }

  private renderStatusBar(type: string) {
    const isPrimary = this.isPrimary();
    // Tile comments are disabled for now; uncomment the logic for showComment to re-enable them
    // const showComment = !isPrimary && (document.type === ProblemPublication);
    const showComment = false;
    return (
      <div className={`statusbar ${type}`}>
        <div className="supports">
          {null}
        </div>
        <div className="actions">
          {isPrimary ? this.renderTwoUpButton() : null}
          {showComment ? this.renderCommentButton() : null}
        </div>
        {this.renderCommentDialog()}
      </div>
    );
  }

  private renderCommentDialog = () => {
    const { isCommentDialogOpen, commentTileId } = this.state;
    if (isCommentDialogOpen) {
      return (
        <SingleStringDialog
          parentId={commentTileId}
          onAccept={this.handleSaveComment}
          onClose={this.handleCloseCommentDialog}
          title="Add Comment"
          prompt="Enter a comment"
          placeholder="Comment..."
          maxLength={100}
        />
      );
    }
  }

  private renderCommentButton() {
    return (
      <div className="tool comment" title="Comment"
          onClick={this.handleComment}>
        <svg className={`icon icon-geometry-comment`}>
          <use xlinkHref={`#icon-geometry-comment`} />
        </svg>
      </div>
    );
  }

  private handleComment = () => {
    // TODO: how to handle comments when multiple tiles are selected?
    //       currently it will select the first tile for commenting
    const { ui: { selectedTileIds } } = this.stores;
    if (selectedTileIds.length > 0) {
      this.setState({
        isCommentDialogOpen: true,
        commentTileId: selectedTileIds[0]
      });
    }
  }

  private handleSaveComment = (comment: string, tileId: string) => {
    const { documents, user } = this.stores;
    const document = documents.findDocumentOfTile(tileId);
    const toolApi = this.toolApiMap[tileId];
    const selectionInfo = toolApi ? toolApi.getSelectionInfo() : undefined;
    if (document) {
      const newComment = TileCommentModel.create({
        uid: user.id,
        text: comment,
        selectionInfo
      });
      let tileComments = document.comments.get(tileId);
      if (!tileComments) {
        tileComments = TileCommentsModel.create({ tileId });
        document.setTileComments(tileId, tileComments);
      }
      tileComments.addComment(newComment);
    }
    this.handleCloseCommentDialog();
  }

  private handleCloseCommentDialog = () => {
    this.setState({ isCommentDialogOpen: false });
  }

  private renderTwoUpButton() {
    const {workspace} = this.props;
    const mode = workspace.comparisonVisible ? "up2" : "up1";
    const modeTitle = workspace.comparisonVisible ? "Return to Student View" : "Open Workspace Compare View";
    return (
      <ViewModeButton onClick={this.handleToggleTwoUp} icon={mode} title={modeTitle} />
    );
  }

  private handleToggleWorkspaceMode = () => {
    this.props.workspace.toggleMode();
  }

  private handleToggleVisibility = () => {
    const doc = this.props.document;
    doc.toggleVisibility();
    Logger.logDocumentEvent(LogEventName.SHOW_WORK, doc);
  }

  private handleToggleTwoUp = () => {
    this.props.workspace.toggleComparisonVisible();
  }

  private handleDownloadTileJson = () => {
    const { clipboard } = this.stores;
    const tileJson = clipboard.getJsonTileContent();
    if (tileJson) {
      const blobJson = new Blob([tileJson], {type: "text/plain;charset=utf-8"});
      FileSaver.saveAs(blobJson, "tile-content.json");
    }
    clipboard.clear();
  }

  private handleNewDocumentClick = () => {
    const { document, onNewDocument } = this.props;
    onNewDocument && onNewDocument(document);
  }

  private handleCopyDocumentClick = () => {
    const { document, onCopyDocument } = this.props;
    onCopyDocument && onCopyDocument(document);
  }

  private handleDeleteDocumentClick = () => {
    const { document, onDeleteDocument } = this.props;
    onDeleteDocument && onDeleteDocument(document);
  }

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
  }

  private handlePublishSupport = () => {
    const { document, onPublishSupport } = this.props;
    onPublishSupport && onPublishSupport(document);
  }

  private handlePublishDocument = () => {
    const { document, onPublishDocument } = this.props;
    onPublishDocument && onPublishDocument(document);
  }

  private isPrimary() {
    return this.props.side === "primary";
  }

  private setStickyNotesVisible = (stickyNotesVisible: boolean) => {
    this.setState({stickyNotesVisible});
    this.stores.db.setLastStickyNoteViewTimestamp();
  }

  // can't use single toggle handler here as the visibility state also depends on
  // new supports automatically making the notes show
  private handleViewStickyNoteOpen = () => {
    Logger.log(LogEventName.OPEN_STICKY_NOTES);
    this.setStickyNotesVisible(true);
  }
  private handleViewStickyNoteClose = () => {
    Logger.log(LogEventName.CLOSE_STICKY_NOTES);
    this.setStickyNotesVisible(false);
  }

}
