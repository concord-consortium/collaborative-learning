import { inject, observer } from "mobx-react";
import * as React from "react";

import "./my-work.sass";
import { TabComponent } from "./tab";
import { TabSetComponent } from "./tab-set";
import { BaseComponent, IBaseProps } from "./base";
import { CanvasComponent } from "./canvas";
import { SectionWorkspaceModelType, PublishedWorkspaceModelType } from "../models/workspaces";
import { sectionInfo } from "../models/curriculum/section";

interface IProps extends IBaseProps {}

@inject("stores")
@observer
export class ClassWorkComponent extends BaseComponent<IProps, {}> {

  public render() {
    const { workspaces, problem } = this.stores;
    const sections = problem.sections;
    const publications: PublishedWorkspaceModelType[] = [];
    sections.forEach((section) => {
      workspaces.getLatestPublicationsForSection(section.id).forEach((publication) => {
        publications.push(publication);
      });
    });

    return (
      <div className="class-work">
        <div className="list">
          {publications.map((workspace) => {
            return (
              <div
                className="list-item"
                key={workspace.document.key}
              >
                <div
                  className="scaled-list-item-container"
                  onClick={this.handleWorkspaceClicked(workspace)}
                  onDragStart={this.handleWorkspaceDragStart(workspace)}
                  draggable={true}
                >
                  <div className="scaled-list-item">
                    <CanvasComponent context="class-work" document={workspace.document} readOnly={true} />
                  </div>
                </div>
                <div className="info">
                  <div>{problem.getSectionById(workspace.sectionId)!.title}</div>
                  <div>{`Group: ${workspace.groupId}`}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // TODO: Factor this out of class work and my work
  private handleWorkspaceClicked = (workspace: PublishedWorkspaceModelType) => {
    const {ui} = this.stores;
    return (e: React.MouseEvent<HTMLDivElement>) => {
      if (ui.bottomNavExpanded) {
        ui.setLLComparisonWorkspace(workspace);
        ui.toggleLLComparisonWorkspaceVisible(true);
      }
      else {
        ui.setAvailableWorkspace(workspace);
        ui.contractAll();
      }
    };
  }

  private handleWorkspaceDragStart = (workspace: PublishedWorkspaceModelType) => {
    return (e: React.DragEvent<HTMLDivElement>) => {
      e.dataTransfer.setData("workspace.document.key", workspace.document.key);
    };
  }
}
