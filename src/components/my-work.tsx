import { inject, observer } from "mobx-react";
import * as React from "react";

import "./my-work.sass";
import { TabComponent } from "./tab";
import { TabSetComponent } from "./tab-set";
import { BaseComponent, IBaseProps } from "./base";
import { CanvasComponent } from "./canvas";
import { WorkspaceModelType } from "../models/workspaces";

interface IProps extends IBaseProps {}

@inject("stores")
@observer
export class MyWorkComponent extends BaseComponent<IProps, {}> {

  public render() {
    const { myWorkExpanded } = this.stores.ui;
    const className = `my-work${myWorkExpanded ? " expanded" : ""}`;
    return (
      <div className={className}>
        <TabSetComponent>
          <TabComponent id="myWorkTab" active={myWorkExpanded} onClick={this.handleClick}>
            My Work
          </TabComponent>
        </TabSetComponent>
        <div className="expanded-area" aria-labelledby="myWorkTab" aria-hidden={!myWorkExpanded}>
          {this.renderList()}
        </div>
      </div>
    );
  }

  private renderList() {
    const {workspaces} = this.stores.workspaces;
    if (workspaces.length === 0) {
      return null;
    }
    return (
      <div className="list">
        {workspaces.map((workspace) => {
          const section = this.stores.problem.getSectionById(workspace.sectionId);
          const title = section ? section.title : undefined;
          return (
            <div
              className="list-item"
              key={workspace.sectionId}
              onClick={this.handleWorkspaceClicked(workspace)}
              title={title}
            >
              <div className="scaled-list-item">
                <CanvasComponent context="my-work" document={workspace.userDocument} readOnly={true} />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  private handleClick = () => {
    this.stores.ui.toggleMyWork();
  }

  private handleWorkspaceClicked = (workspace: WorkspaceModelType) => {
    const {ui} = this.stores;
    return (e: React.MouseEvent<HTMLDivElement>) => {
      ui.setActiveWorkspaceSectionId(workspace.sectionId);
      ui.contractAll();
    };
  }
}
