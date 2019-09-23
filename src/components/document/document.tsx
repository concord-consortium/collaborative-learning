import { inject, observer } from "mobx-react";
import * as React from "react";
import * as FileSaver from "file-saver";

import { CanvasComponent } from "./canvas";
import { DocumentContext, IDocumentContext } from "./document-context";
import { FourUpComponent } from "../four-up";
import { BaseComponent, IBaseProps } from "../base";
import { DocumentModelType, ISetProperties, LearningLogDocument, LearningLogPublication,
         ProblemDocument,  SupportPublication} from "../../models/document/document";
import { ToolbarComponent } from "../toolbar";
import { IToolApi, IToolApiInterface, IToolApiMap } from "../tools/tool-tile";
import { WorkspaceModelType } from "../../models/stores/workspace";
import { TileCommentModel, TileCommentsModel } from "../../models/tools/tile-comments";
import { ToolbarConfig } from "../../models/tools/tool-types";
import { IconButton } from "../utilities/icon-button";
import SingleStringDialog from "../utilities/single-string-dialog";

import "./document.sass";

export type WorkspaceSide = "primary" | "comparison";

interface IProps extends IBaseProps {
  workspace: WorkspaceModelType;
  document: DocumentModelType;
  onNewDocument?: (document: DocumentModelType) => void;
  onCopyDocument?: (document: DocumentModelType) => void;
  onDeleteDocument?: (document: DocumentModelType) => void;
  toolbar?: ToolbarConfig;
  side: WorkspaceSide;
  readOnly?: boolean;
  isGhostUser?: boolean;
}

interface IState {
  documentKey: string;
  documentContext?: IDocumentContext;
  isCommentDialogOpen: boolean;
  commentTileId: string;
}

type SVGClickHandler = (e: React.MouseEvent<SVGSVGElement>) => void;

const DownloadButton = ({ onClick }: { onClick: SVGClickHandler }) => {
  return (
    <svg key="download" className={`action icon icon-download`} onClick={onClick}>
      <use xlinkHref={`#icon-publish`} />
    </svg>
  );
};

const PublishButton = ({ onClick, dataTestName }: { onClick: SVGClickHandler, dataTestName?: string }) => {
  const dataTest = dataTestName || "publish-icon";
  return (
    <svg key="publish" className={`action icon icon-publish`}
          data-test={dataTest} onClick={onClick} >
      <use xlinkHref={`#icon-publish`} />
    </svg>
  );
};

const NewButton = ({ onClick }: { onClick: () => void }) => {
  return (
    <IconButton icon="new" key="new" className="action icon-new"
                onClickButton={onClick} />
  );
};

const EditButton = ({ onClick }: { onClick: () => void }) => {
  return (
    <IconButton icon="edit" key="edit" className="action icon-edit"
                onClickButton={onClick} />
  );
};

const CopyButton = ({ onClick }: { onClick: () => void }) => {
  return (
    <IconButton icon="copy" key="copy" className="action icon-copy"
                onClickButton={onClick} />
  );
};

const DeleteButton = ({ onClick }: { onClick: () => void }) => {
  return (
    <IconButton icon="delete" key="delete" className="action icon-delete"
                onClickButton={onClick} />
  );
};

const ShareButton = ({ isShared, onClick }: { isShared: boolean, onClick: SVGClickHandler }) => {
  const visibility = isShared ? "public" : "private";
  return (
    <div key="share" className={`visibility action ${visibility}`}>
      <svg id="currVis" className={`share icon icon-share`}
            data-test="share-icon" onClick={onClick}>
        <use xlinkHref={`#icon-share`} />
      </svg>
    </div>
  );
};

@inject("stores")
@observer
export class DocumentComponent extends BaseComponent<IProps, IState> {

  public static getDerivedStateFromProps: any = (nextProps: IProps, prevState: IState) => {
    const { document } = nextProps;
    const documentContext: IDocumentContext = {
            getProperty: (key: string) => document.properties.get(key),
            setProperties: (properties: ISetProperties) => document.setProperties(properties)
          };
    return document.key === prevState.documentKey
            ? {}
            : { documentKey: document.key, documentContext };
  }

  private toolApiMap: IToolApiMap = {};
  private toolApiInterface: IToolApiInterface;

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
      documentKey: props.document.key,
      isCommentDialogOpen: false,
      commentTileId: ""
    };
  }

  public render() {
    const { document: { type } } = this.props;
    return (
      <DocumentContext.Provider value={this.state.documentContext}>
        {this.renderToolbar()}
        <div key="document" className="document">
          {this.renderTitleBar(type)}
          {this.renderCanvas()}
          {this.renderStatusBar(type)}
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
    const {problem, appMode, clipboard, user} = this.stores;
    const problemTitle = problem.title;
    const {document: { visibility }, workspace} = this.props;
    const isShared = visibility === "public";
    const showShare = !user.isTeacher;
    const show4up = !workspace.comparisonVisible && !user.isTeacher;
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
          {problemTitle}
        </div>
        {!hideButtons &&
          <div className="actions" data-test="document-titlebar-actions">
            {[
              downloadButton,
              <PublishButton key="publish" onClick={this.handlePublishWorkspace} />,
              showShare ? <ShareButton key="share" isShared={isShared} onClick={this.handleToggleVisibility} /> : null
            ]}
            {show4up ? this.renderMode() : null}
          </div>
        }
      </div>
    );
  }

  private renderMode() {
    const {workspace} = this.props;
    const currMode = workspace.mode === "1-up" ? "up1" : "up4";
    const nextMode = workspace.mode === "1-up" ? "up4" : "up1";
    // render both icons and show the correct one with CSS
    return (
      <div className="mode action">
        <svg id="currMode" className={`mode icon icon-${currMode}`} onClick={this.handleToggleWorkspaceMode}>
          <use xlinkHref={`#icon-${currMode}`} />
        </svg>
        <svg id="nextMode" key="nextMode" className={`mode icon icon-${nextMode}`}
          onClick={this.handleToggleWorkspaceMode}
        >
          <use xlinkHref={`#icon-${nextMode}`} />
        </svg>
      </div>
    );
  }

  private renderOtherDocumentTitleBar(type: string, hideButtons?: boolean) {
    const {document} = this.props;
    return (
      <div className={`titlebar ${type}`}>
        {!hideButtons &&
          <div className="actions">
            <NewButton onClick={this.handleNewDocumentClick} />
            <CopyButton onClick={this.handleCopyDocumentClick} />
            <DeleteButton onClick={this.handleDeleteDocumentClick} />
          </div>
        }
        {
          document.type === LearningLogDocument || document.type === LearningLogPublication
          ? <div className="title" data-test="learning-log-title">
              <span className="title-info">Learning Log: {document.title}</span>
              { !hideButtons && <EditButton onClick={this.handleDocumentRename} /> }
            </div>
          : <div className="title" data-test="personal-doc-title">
              <span>{document.title}</span>
              { !hideButtons && <EditButton onClick={this.handleDocumentRename} /> }
            </div>
        }
        <div className="actions">
          {!hideButtons &&
            <div className="actions">
              <PublishButton dataTestName="other-doc-publish-icon" onClick={this.handlePublishOtherDocument} />
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
    // const showComment = !isPrimary && (document.type === PublicationDocument);
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
    const { ui: { selectedTileId } } = this.stores;
    if (selectedTileId ) {
      this.setState({
        isCommentDialogOpen: true,
        commentTileId: selectedTileId
      });
    }
  }

  private handleSaveComment = (comment: string, tileId: string) => {
    const { documents, db, user } = this.stores;
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
    const currMode = workspace.comparisonVisible ? "up2" : "up1";
    const nextMode = workspace.comparisonVisible ? "up1" : "up2";

    return (
      <div className="mode action">
        <svg id="currMode" className={`mode icon icon-${currMode}`} data-test="two-up-curr-mode"
             onClick={this.handleToggleTwoUp}>
          <use xlinkHref={`#icon-${currMode}`} />
        </svg>
        <svg id="nextMode" key="nextMode" className={`mode icon icon-${nextMode}`} data-test="two-up-next-mode"
             onClick={this.handleToggleTwoUp}
        >
          <use xlinkHref={`#icon-${nextMode}`} />
        </svg>
      </div>
    );
  }

  private handleToggleWorkspaceMode = () => {
    this.props.workspace.toggleMode();
  }

  private handleToggleVisibility = () => {
    this.props.document.toggleVisibility();
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
    const docTypeString = document.isPersonal ? "Personal Document" : "Learning Log";
    this.stores.ui.prompt(`Rename your ${docTypeString}:`, document.title, `Renaming ${docTypeString}`)
      .then((title: string) => {
        if (title !== document.title) {
          document.setTitle(title);
        }
      });
  }

  private handlePublishWorkspace = () => {
    const { db, ui } = this.stores;
    // TODO: Disable publish button while publishing
    db.publishProblemDocument(this.props.document)
      .then(() => ui.alert("Your document was published.", "Document Published"));
  }

  private handlePublishOtherDocument = () => {
    const { db, ui } = this.stores;
    const documentType = this.props.document.type === "personal"
                          ? "Personal Document"
                          : "Learning Log";
    db.publishOtherDocument(this.props.document)
      .then(() => ui.alert("Your document was published.", `${documentType} Published`));
  }

  private isPrimary() {
    return this.props.side === "primary";
  }

}
