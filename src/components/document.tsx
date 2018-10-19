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
    return (
      <div className="document">
        {this.renderTitleBar()}
        {showToolbar ? this.renderToolbar() : null}
        {this.renderCanvas()}
        {this.renderStatusBar()}
      </div>
    );
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
    const {ui, problem} = this.stores;
    const {workspace, document} = this.props;
    const activeSection = problem.getSectionById(document.sectionId!);
    const show4up = !workspace.comparisonVisible;
    const share = document.visibility === "private" ? "share" : "unshare";
    return (
      <div className="titlebar">
        <div className="title">{activeSection ? `Section: ${activeSection.title}` : "Section"}</div>
        {!hideButtons &&
          <div className="actions">
            <svg className={`icon icon-publish`} onClick={this.handlePublishWorkspace}>
              <use xlinkHref={`#icon-publish`} />
            </svg>
            <svg className={`icon icon-${share}`} onClick={this.handleToggleVisibility}>
              <use xlinkHref={`#icon-${share}`} />
            </svg>
            {show4up ? this.renderMode() : null}
          </div>
        }
      </div>
    );
  }

  private renderMode() {
    const {workspace} = this.props;
    const mode = workspace.mode === "1-up" ? "up1" : "up";
    return (
      <svg className={`icon icon-${mode}`} onClick={this.handleToggleWorkspaceMode}>
        <use xlinkHref={`#icon-${mode}`} />
      </svg>
    );
  }

  private renderLearningLogTitleBar() {
    const {workspace, document} = this.props;
    return (
      <div className="titlebar">
        <div className="title">Learning Log: {document.title}</div>
        <div className="actions" />
      </div>
    );
  }

  private renderToolbar() {
    const {document} = this.props;
    const handleClickTool = (tool: DocumentTool) => {
      const { ui } = this.stores;
      return (e: React.MouseEvent<HTMLDivElement>) => {
        switch (tool) {
          case "delete":
            if (ui.selectedTileId) {
              document.deleteTile(ui.selectedTileId);
            }
            break;
          default:
            document.addTile(tool, tool === "geometry");
        }
      };
    };
    return (
      <div className="toolbar">
        <div className="tool select" title="Select" onClick={handleClickTool("select")}>↖</div>
        <div className="tool text" title="Text" onClick={handleClickTool("text")}>T</div>
        <div className="tool geometry" title="Geometry" onClick={handleClickTool("geometry")}/>
        <div className="tool image" title="Image" onClick={handleClickTool("image")}/>
        <div className="tool delete" title="Delete" onClick={handleClickTool("delete")}>{"\u274c"}</div>
      </div>
    );
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
    const {ui} = this.stores;
    const {workspace} = this.props;
    const mode = workspace.comparisonVisible ? "up" : "up2";

    return (
      <svg className={`icon icon-${mode}`} onClick={this.handleToggleTwoUp}>
        <use xlinkHref={`#icon-${mode}`} />
      </svg>
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
