import { inject, observer } from "mobx-react";
import * as React from "react";
import { HeaderComponent } from "./header";
import { LeftNavComponent } from "./left-nav";
import { RightNavComponent } from "./right-nav";
import { BottomNavComponent } from "./bottom-nav";
import { WorkspaceComponent } from "./workspace";
import { BaseComponent, IBaseProps } from "./base";
import { DialogComponent } from "./dialog";

import "./app-container.sass";

type WorkspaceSide = "primary" | "comparison";

interface IProps extends IBaseProps {}

@inject("stores")
@observer
export class AppContainerComponent extends BaseComponent<IProps, {}> {

  public render() {
    return (
      <div className="app-container">
        <HeaderComponent />
        {this.renderWorkspaces()}
        <LeftNavComponent />
        <BottomNavComponent />
        <RightNavComponent />
        <DialogComponent dialog={this.stores.ui.dialog} />
      </div>
    );
  }

  private handleRemoveBlocker = () => {
    this.stores.ui.contractAll();
  }

  private renderWorkspaces() {
    const {ui, workspaces} = this.stores;
    const primaryWorkspace = ui.primaryWorkspaceDocumentKey
                        ? workspaces.getWorkspace(ui.primaryWorkspaceDocumentKey)
                        : null;
    const comparisonWorkspace = ui.comparisonWorkspaceDocumentKey
                        ? workspaces.getWorkspace(ui.comparisonWorkspaceDocumentKey)
                        : null;

    if (!primaryWorkspace) {
      return this.renderWorkspace("single-workspace", "primary");
    }

    if (ui.comparisonWorkspaceVisible) {
      return (
        <div onMouseOver={this.handleMouseOver}>
          {this.renderWorkspace(
            "left-workspace",
            "primary",
            <WorkspaceComponent workspace={primaryWorkspace} side="primary" />
          )}
          {this.renderWorkspace("right-workspace", "comparison", comparisonWorkspace
              ? <WorkspaceComponent workspace={comparisonWorkspace} readOnly={true} side="comparison" />
              : this.renderComparisonPlaceholder())}
        </div>
      );
    }
    else {
      return this.renderWorkspace(
               "single-workspace",
               "primary",
               <WorkspaceComponent workspace={primaryWorkspace} side="primary" />
             );
    }
  }

  private renderWorkspace(className: string, side: WorkspaceSide, child?: JSX.Element) {
    return (
      <div
        className={className}
        onDragOver={this.handleDragOver}
        onDrop={this.handleDrop(side)}
        onMouseOver={this.handleMouseOver}
      >
        {child}
      </div>
    );
  }

  private renderComparisonPlaceholder() {
    return (
      <div className="comparison-placeholder">
        Click or drag an item in the right tabs to show it here
      </div>
    );
  }

  private handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer.getData("workspace.document.key")) {
      e.preventDefault();
    }
  }

  private handleDrop = (side: WorkspaceSide) => {
    return (e: React.DragEvent<HTMLDivElement>) => {
      const {ui, workspaces} = this.stores;
      const documentKey = e.dataTransfer.getData("workspace.document.key");
      const workspace = documentKey ? workspaces.getWorkspace(documentKey) : null;
      if (workspace) {
        if (side === "primary") {
          ui.setPrimaryWorkspace(workspace);
        }
        else {
          ui.setComparisonWorkspace(workspace);
        }
      }
    };
  }

  private handleMouseOver = (e: React.MouseEvent<HTMLDivElement>) => {
    this.stores.ui.contractAll();
  }
}
