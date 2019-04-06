import { inject, observer } from "mobx-react";
import * as React from "react";
import * as FileSaver from "file-saver";

import { SupportItemModelType, SupportType } from "../../models/stores/supports";
import { CanvasComponent } from "./canvas";
import { FourUpComponent } from "../four-up";
import { BaseComponent, IBaseProps } from "../base";
import { DocumentModelType, SectionDocument, PublicationDocument } from "../../models/document/document";
import { ToolbarComponent } from "../toolbar";
import { IToolApi, IToolApiInterface, IToolApiMap } from "../tools/tool-tile";
import { WorkspaceModelType } from "../../models/stores/workspace";
import { SectionType } from "../../models/curriculum/section";
import { TileCommentModel, TileCommentsModel } from "../../models/tools/tile-comments";
import DocumentDialog from "../utilities/document-dialog";

import "./document.sass";

export type WorkspaceSide = "primary" | "comparison";

interface IProps extends IBaseProps {
  workspace: WorkspaceModelType;
  document: DocumentModelType;
  side: WorkspaceSide;
  readOnly?: boolean;
  isGhostUser?: boolean;
}

interface IState {
  isCommentDialogOpen: boolean;
  commentTileId: string;
}

@inject("stores")
@observer
export class DocumentComponent extends BaseComponent<IProps, IState> {

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
      }
    };

    this.state = {
      isCommentDialogOpen: false,
      commentTileId: ""
    };
  }

  public render() {
    const {document, isGhostUser, readOnly} = this.props;
    const isPublication = document.isPublished;
    const showToolbar = this.isPrimary() && !isGhostUser && !readOnly && !isPublication;
    return [
        showToolbar ? this.renderToolbar() : null,
        <div key="document" className="document">
          {this.renderTitleBar()}
          {this.renderCanvas()}
          {this.renderStatusBar()}
        </div>
    ];
  }

  private renderTitleBar() {
    const { document, side, isGhostUser } = this.props;
    const hideButtons = isGhostUser || (side === "comparison") || document.isPublished;
    if (document.isSection) {
      return this.renderSectionTitleBar(hideButtons);
    }
    if (document.isLearningLog) {
      return this.renderLearningLogTitleBar(hideButtons);
    }
  }

  private renderSectionTitleBar(hideButtons?: boolean) {
    const {problem, appMode, clipboard} = this.stores;
    const {workspace, document} = this.props;
    const activeSection = problem.getSectionById(document.sectionId!);
    const show4up = !workspace.comparisonVisible;
    const downloadButton = (appMode !== "authed") && clipboard.hasJsonTileContent()
                            ? <svg key="download" className={`action icon icon-download`}
                                    onClick={this.handleDownloadTileJson}>
                                <use xlinkHref={`#icon-publish`} />
                              </svg>
                            : undefined;
    return (
      <div className="titlebar">
        <div className="title" data-test="document-title">
          {activeSection ? `Section: ${activeSection.title}` : "Section"}
        </div>
        {!hideButtons &&
          <div className="actions" data-test="document-titlebar-actions">
            {[
              downloadButton,
              <svg key="publish" className={`action icon icon-publish`} data-test="publish-icon"
                   onClick={this.handlePublishWorkspace}>
                <use xlinkHref={`#icon-publish`} />
              </svg>,
              this.renderShare()
            ]}
            {show4up ? this.renderMode() : null}
          </div>
        }
      </div>
    );
  }

  private renderShare() {
    const {document} = this.props;
    const currVis = document.visibility === "private" ? "private" : "public";
    return (
      <div key="share" className={`visibility action ${currVis}`}>
        <svg id="currVis" className={`share icon icon-share`} data-test="share-icon"
             onClick={this.handleToggleVisibility}>
          <use xlinkHref={`#icon-share`} />
        </svg>
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

  private renderLearningLogTitleBar(hideButtons?: boolean) {
    const {document} = this.props;
    return (
      <div className="learning-log titlebar">
        <div className="actions">
          {!hideButtons &&
            <div className="actions">
              <svg key="publish" className={`icon icon-publish`} data-test="learning-log-publish-icon"
                   onClick={this.handlePublishLearningLog}>
                <use xlinkHref={`#icon-publish`} />
              </svg>
            </div>
          }
        </div>
        <div className="title" data-test="learning-log-title">Learning Log: {document.title}</div>
      </div>
    );
  }

  private renderToolbar() {
    return <ToolbarComponent key="toolbar" document={this.props.document}
                              toolApiMap={this.toolApiMap} />;
  }

  private renderCanvas() {
    const { document, workspace, side, isGhostUser } = this.props;
    const fourUp = (document.type === SectionDocument) &&
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
                        toolApiInterface={this.toolApiInterface} toolApiMap={this.toolApiMap} />
    );
  }

  private render4UpCanvas() {
    const {isGhostUser, document} = this.props;
    const {sectionWorkspace} = this.stores.ui;
    return (
      <FourUpComponent document={document} workspace={sectionWorkspace} isGhostUser={isGhostUser}
                        toolApiInterface={this.toolApiInterface} />
    );
  }

  private renderStatusBar() {
    const {document} = this.props;
    const isPrimary = this.isPrimary();
    const showContents = isPrimary && (document.type === SectionDocument);
    const showComment = !isPrimary && (document.type === PublicationDocument);
    return (
      <div className="statusbar">
        <div className="supports">
          {showContents ? this.renderSupportIcons() : null}
          {showContents ? this.renderVisibleSupports() : null}
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
        <DocumentDialog
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

  private renderSupportIcons() {
    const supports = this.getSupportsWithIndices();
    const anyActive = supports.some((support) => support.item.visible);
    return (
      <div className="supports-list">
        {supports.map((support) => {
          const {index, item} = support;
          const visibility = !anyActive || item.visible ? "show" : "hide";
          const audience = item.supportType === SupportType.teacher ? item.audience.type : "curricular";
          return (
            <svg
              key={index}
              onClick={this.handleToggleSupport(item)}
              className={`icon ${this.getSupportName(index)} ${visibility}`}
              data-test={`support-icon ${audience}`}
            >
              <use xlinkHref={`#${this.getSupportName(index)}`} />
            </svg>
          );
        })}
      </div>
    );
  }

  private getSupportName(supportIndex: number) {
    // There are currently 4 (0-based) support icons defined in index.html
    const safeIndex = supportIndex % 4;
    return `icon-support${safeIndex}`;
  }

  private renderVisibleSupports() {
    const supports = this.getSupportsWithIndices().filter((supportWithIndex) => supportWithIndex.item.visible);
    if (supports.length === 0) {
      return null;
    }
    return (
      <div className="visible-supports">
        <div className="supports-list" data-test="supports-list">
          {supports.map((support) => {
            return (
              <div key={support.index} onClick={this.handleToggleSupport(support.item)}>
                {support.item.text}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  private handleToggleWorkspaceMode = () => {
    this.props.workspace.toggleMode();
  }

  private handleToggleVisibility = () => {
    this.props.document.toggleVisibility();
  }

  private handleToggleSupport = (support: SupportItemModelType) => {
    return () => this.stores.supports.toggleSupport(support);
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

  private handlePublishWorkspace = () => {
    const { db, ui } = this.stores;
    // TODO: Disable publish button while publishing
    db.publishDocument(this.props.document)
      .then(() => ui.alert("Your document was published.", "Document Published"));
  }

  private handlePublishLearningLog = () => {
    const { db, ui } = this.stores;
    db.publishLearningLog(this.props.document)
      .then(() => ui.alert("Your document was published.", "Learning Log Published"));
  }

  private getSupportsWithIndices() {
    const { groups, user } = this.stores;
    const userId = user.id;
    const group = groups.groupForUser(userId);
    const groupId = group && group.id;
    return this.stores.supports.getSupportsForUserProblem(
      this.props.document.sectionId! as SectionType,
      groupId,
      userId
    )
    .map((support, index) => {
      return {index, item: support};
    });
  }

  private isPrimary() {
    return this.props.side === "primary";
  }

}
