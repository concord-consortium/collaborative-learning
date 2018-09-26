import { inject, observer } from "mobx-react";
import * as React from "react";

import "./my-work.sass";
import { TabComponent } from "./tab";
import { TabSetComponent } from "./tab-set";
import { BaseComponent, IBaseProps } from "./base";
import { CanvasComponent } from "./canvas";
import { SectionWorkspaceModelType } from "../models/workspaces";

interface IProps extends IBaseProps {}

@inject("stores")
@observer
export class MyWorkComponent extends BaseComponent<IProps, {}> {

  public render() {
    const {sections} = this.stores.workspaces;
    if (sections.length === 0) {
      return null;
    }
    return (
      <div className="my-work">
        <div className="list">
          {sections.map((workspace) => {
            const section = this.stores.problem.getSectionById(workspace.sectionId);
            const title = section ? section.title : undefined;
            return (
              <div
                className="list-item"
                key={workspace.sectionId}
                title={title}
              >
                <div
                  className="scaled-list-item-container"
                  onClick={this.handleWorkspaceClicked(workspace)}
                  onDragStart={this.handleWorkspaceDragStart(workspace)}
                  draggable={true}
                >
                  <div className="scaled-list-item">
                    <CanvasComponent context="my-work" document={workspace.document} readOnly={true} />
                  </div>
                </div>
                <div className="info">
                  {title}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  private handleWorkspaceClicked = (workspace: SectionWorkspaceModelType) => {
    const {ui} = this.stores;
    return (e: React.MouseEvent<HTMLDivElement>) => {
      if (ui.bottomNavExpanded) {
        if (ui.llPrimaryWorkspaceDocumentKey) {
          ui.setLLComparisonWorkspace(workspace);
          ui.toggleLLComparisonWorkspaceVisible(true);
        }
        else {
          alert("Sorry, you must first select a learning log.");
        }
      }
      else {
        ui.setAvailableWorkspace(workspace);
        ui.contractAll();
      }
    };
  }

  private handleWorkspaceDragStart = (workspace: SectionWorkspaceModelType) => {
    return (e: React.DragEvent<HTMLDivElement>) => {
      e.dataTransfer.setData("workspace.document.key", workspace.document.key);
    };
  }
}
