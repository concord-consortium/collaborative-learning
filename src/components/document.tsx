import { inject, observer } from "mobx-react";
import * as React from "react";

import { SupportItemModelType } from "../models/supports";
import { CanvasComponent } from "./canvas";
import { FourUpComponent } from "./four-up";
import { BaseComponent, IBaseProps } from "./base";
import { DocumentModelType,
         SectionDocument,
         LearningLogDocument,
         PublicationDocument,
         DocumentTool
       } from "../models/document";
import { WorkspaceModelType } from "../models/workspace";

import "./document.sass";
import { ToolbarComponent } from "./toolbar";

export type WorkspaceSide = "primary" | "comparison";

interface IProps extends IBaseProps {
  workspace: WorkspaceModelType;
  document: DocumentModelType;
  side: WorkspaceSide;
  readOnly?: boolean;
  isGhostUser?: boolean;
}

@inject("stores")
@observer
export class DocumentComponent extends BaseComponent<IProps, {}> {

  public render() {
    const {document, isGhostUser, readOnly} = this.props;
    const isPublication = document.type === PublicationDocument;
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
    if (document.type === SectionDocument) {
      return this.renderSectionTitleBar(isGhostUser || (side === "comparison"));
    }
    if (document.type === LearningLogDocument) {
      return this.renderLearningLogTitleBar();
    }
    if (document.type === PublicationDocument) {
      return this.renderSectionTitleBar(true);
    }
  }

  private renderSectionTitleBar(hideButtons?: boolean) {
    const {problem} = this.stores;
    const {workspace, document} = this.props;
    const activeSection = problem.getSectionById(document.sectionId!);
    const show4up = !workspace.comparisonVisible;
    const share = document.visibility === "private" ? "share" : "unshare";
    return (
      <div className="titlebar">
        <div className="title">{activeSection ? `Section: ${activeSection.title}` : "Section"}</div>
        {!hideButtons &&
          <div className="actions">
            {[
              <svg key="publish" className={`icon icon-publish`} onClick={this.handlePublishWorkspace}>
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
        <svg id="currVis" className={`share icon icon-share`} onClick={this.handleToggleVisibility}>
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

  private renderLearningLogTitleBar() {
    const {document} = this.props;
    return (
      <div className="titlebar">
        <div className="title">Learning Log: {document.title}</div>
        <div className="actions" />
      </div>
    );
  }

  private renderToolbar() {
    return <ToolbarComponent key="toolbar" document={this.props.document} />;
  }

  private renderCanvas() {
    const { document, workspace, side, isGhostUser } = this.props;
    if (document.type === SectionDocument) {
      if (isGhostUser) {
        return <div className="canvas-area">{this.render4UpCanvas()}</div>;
      }
      return (
        <div className="canvas-area">
          {side === "primary"
            ? (workspace.mode === "1-up" ? this.render1UpCanvas() : this.render4UpCanvas())
            : this.render1UpCanvas()
          }
        </div>
      );
    }
    if (document.type === LearningLogDocument) {
      return (
        <div className="canvas-area learning-log-canvas-area">
          {this.render1UpCanvas()}
        </div>
      );
    }
    if (document.type === PublicationDocument) {
      return (
        <div className="canvas-area learning-log-canvas-area">
          {this.render1UpCanvas(true)}
        </div>
      );
    }
  }

  private render1UpCanvas(forceReadOnly?: boolean) {
    const readOnly = forceReadOnly ? true : this.props.readOnly;
    return (
      <CanvasComponent context="1-up" document={this.props.document} readOnly={readOnly} />
    );
  }

  private render4UpCanvas() {
    const {isGhostUser, document} = this.props;
    const {sectionWorkspace} = this.stores.ui;
    return (
      <FourUpComponent document={document} workspace={sectionWorkspace} isGhostUser={isGhostUser} />
    );
  }

  private renderStatusBar() {
    const {document} = this.props;
    const isPrimary = this.isPrimary();
    const showContents = isPrimary && (document.type === SectionDocument);
    return (
      <div className="statusbar">
        <div className="supports">
          {showContents ? this.renderSupportIcons() : null}
          {showContents ? this.renderVisibleSupports() : null}
        </div>
        <div className="actions">
          {isPrimary ? this.renderTwoUpButton() : null}
        </div>
      </div>
    );
  }

  private renderTwoUpButton() {
    const {workspace} = this.props;
    const currMode = workspace.comparisonVisible ? "up2" : "up1";
    const nextMode = workspace.comparisonVisible ? "up1" : "up2";

    return (
      <div className="mode action">
        <svg id="currMode" className={`mode icon icon-${currMode}`} onClick={this.handleToggleTwoUp}>
          <use xlinkHref={`#icon-${currMode}`} />
        </svg>
        <svg id="nextMode" key="nextMode" className={`mode icon icon-${nextMode}`}
          onClick={this.handleToggleTwoUp}
        >
          <use xlinkHref={`#icon-${nextMode}`} />
        </svg>
      </div>
    );
  }

  private renderSupportIcons() {
    const supports = this.getSupportsWithIndices();
    return (
      <div className="supports-list">
        {supports.map((support) => {
          return (
            <span
              key={support.index}
              onClick={this.handleToggleSupport(support.item)}
              className={support.item.visible ? "active" : undefined}
            >
              {support.index}
            </span>
          );
        })}
      </div>
    );
  }

  private renderVisibleSupports() {
    const supports = this.getSupportsWithIndices().filter((supportWithIndex) => supportWithIndex.item.visible);
    if (supports.length === 0) {
      return null;
    }
    return (
      <div className="visible-supports">
        <div className="supports-list">
          {supports.map((support) => {
            return (
              <div key={support.index} onClick={this.handleToggleSupport(support.item)}>
                <span>{support.index}</span> {support.item.text}
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

  private handlePublishWorkspace = () => {
    const { db, ui } = this.stores;
    // TODO: Disable publish button while publishing
    db.publishDocument(this.props.document)
      .then(() => ui.alert("Your document was published.", "Document Published"));
  }

  private getSupportsWithIndices() {
    return this.stores.supports.getAllForSection(this.props.document.sectionId!).map((support, index) => {
      return {index: index + 1, item: support};
    });
  }

  private isPrimary() {
    return this.props.side === "primary";
  }

}
