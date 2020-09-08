import { inject, observer } from "mobx-react";
import { autorun, IReactionDisposer } from "mobx";
import React from "react";
import FileSaver from "file-saver";

import { AppConfigContext } from "../../app-config-context";
import { CanvasComponent } from "./canvas";
import { DocumentContext, IDocumentContext } from "./document-context";
import { DocumentFileMenu } from "./document-file-menu";
import { FourUpComponent } from "../four-up";
import { BaseComponent, IBaseProps } from "../base";
import { ToolbarComponent, ToolbarConfig } from "../toolbar";
import { IToolApi, IToolApiInterface, IToolApiMap } from "../tools/tool-tile";
import { DocumentModelType, ISetProperties, LearningLogDocument, LearningLogPublication,
         ProblemDocument } from "../../models/document/document";
import { SupportType, TeacherSupportModelType, AudienceEnum } from "../../models/stores/supports";
import { WorkspaceModelType } from "../../models/stores/workspace";
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
    <svg className={`action icon icon-download`} onClick={onClick}>
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

const PublishSupportButton = ({ onClick }: { onClick: () => void }) => {
  return (
    <IconButton icon="publish-support" key="support" className="action icon-support"
                onClickButton={onClick} title="publish to supports" />
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
    return { documentContext };
  }

  private toolApiMap: IToolApiMap = {};
  private toolApiInterface: IToolApiInterface;
  private stickyNoteIcon: HTMLDivElement | null;
  private documentContainer: HTMLDivElement | null;
  private deleteHandler: { documentKey?: string, disposer?: IReactionDisposer } = {};

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

  public componentDidMount() {
    this.configureDeleteHandler();
  }

  public componentDidUpdate() {
    this.configureDeleteHandler();
  }

  public componentWillUnmount() {
    this.deleteHandler.disposer?.();
  }

  public render() {
    const { document: { type } } = this.props;
    return (
      <DocumentContext.Provider value={this.state.documentContext}>
        <div key="document" className="document" ref={(el) => this.documentContainer = el}>
          {this.renderTitleBar(type)}
          {this.renderToolbar()}
          <div className="canvas-separator"/>
          {this.renderCanvas()}
          {this.renderStickyNotesPopup()}
        </div>
      </DocumentContext.Provider>
    );
  }

  private configureDeleteHandler() {
    const { deleteHandler, props: { document, side }, stores } = this;
    if (document.key !== deleteHandler.documentKey) {
      // dispose any previous delete handler
      deleteHandler.disposer?.();
      // install delete handler for current document
      deleteHandler.disposer = autorun(reaction => {
        const isDeleted = document.getProperty("isDeleted");
        // close comparison when comparison document is deleted
        if (isDeleted && (side === "comparison")) {
          const { ui: { problemWorkspace } } = stores;
          problemWorkspace.toggleComparisonVisible({ override: false, muteLog: true });
        }
      });
    }
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
          <div className="actions left">
            <DocumentFileMenu document={document}
              onNewDocument={this.handleNewDocumentClick}
              onCopyDocument={this.handleCopyDocumentClick}
              isDeleteDisabled={true} />
            {this.showPublishButton(document) &&
              <PublishButton key="publish" onClick={this.handlePublishDocument} />}
          </div>
        }
        <div className="title" data-test="document-title">
          {problemTitle} {this.renderStickyNotes()}
        </div>
        {!hideButtons &&
          <div className="actions right" data-test="document-titlebar-actions">
            {downloadButton}
            {isTeacher &&
              <PublishSupportButton onClick={this.handlePublishSupport} />}
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
    const { appConfig, user: { isTeacher }, documents, user } = this.stores;
    const otherDocuments = documents.byTypeForUser(document.type, user.id);
    const countNotDeleted = otherDocuments.reduce((prev, doc) => doc.getProperty("isDeleted") ? prev : prev + 1, 0);
    const { supportStackedTwoUpView } = appConfig;
    const isPrimary = this.isPrimary();
    const displayId = document.getDisplayId(appConfig);
    const hasDisplayId = !!displayId;
    return (
      <div className={`titlebar ${type}`}>
        {!hideButtons &&
          <div className="actions">
            <DocumentFileMenu document={document}
              onNewDocument={this.handleNewDocumentClick}
              onCopyDocument={this.handleCopyDocumentClick}
              isDeleteDisabled={countNotDeleted < 1}
              onDeleteDocument={this.handleDeleteDocumentClick}/>
            {!hideButtons && this.showPublishButton(document) &&
              <PublishButton dataTestName="other-doc-publish-icon" onClick={this.handlePublishDocument} />}
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
          {!hideButtons && isTeacher && <PublishSupportButton key="otherDocPub" onClick={this.handlePublishSupport} />}
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

  private renderToolbar() {
    const {document, isGhostUser, readOnly, toolbar} = this.props;
    const isPublication = document.isPublished;
    const showToolbar = this.isPrimary() && !isGhostUser && !readOnly && !isPublication;
    if (!showToolbar || !toolbar) return;
    return (
      <AppConfigContext.Consumer>
        {appConfig => {
          const toolbarConfig = (toolbar || {}).map(tool => ({ icon: appConfig.appIcons?.[tool.iconId], ...tool }));
          return (
            <ToolbarComponent key="toolbar" document={this.props.document}
                              config={toolbarConfig} toolApiMap={this.toolApiMap} />
          );
        }}
      </AppConfigContext.Consumer>
    );
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
  private handleShowTwoUp = () => {
    this.props.workspace.toggleComparisonVisible({override: true});
  }
  private handleHideTwoUp = () => {
    this.props.workspace.toggleComparisonVisible({override: false});
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
