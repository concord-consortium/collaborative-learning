import { inject, observer } from "mobx-react";
import * as React from "react";
import { BaseComponent, IBaseProps } from "./base";
import { SectionModelType } from "../models/curriculum/section";
import { DocumentContentModelType } from "../models/document-content";

import "./left-nav-panel.sass";
import { CanvasComponent } from "./canvas";

interface IProps extends IBaseProps {
  section?: SectionModelType | null;
}

@inject("stores")
@observer
export class LeftNavPanelComponent extends BaseComponent<IProps, {}> {
  private openWorkspaceButton: HTMLButtonElement | null;

  public render() {
    const { section } = this.props;

    return (
      <div className="left-nav-panel">
        {section ? this.renderSection(section) : null}
      </div>
    );
  }

  private renderSection(section: SectionModelType) {
    const {content} = section;
    return (
      <div className="section">
        <div className="section-header">
          <h1>{section.title}</h1>
        </div>
        {content ? this.renderContent(section, content) : null}
      </div>
    );
  }

  private renderContent(section: SectionModelType, content: DocumentContentModelType) {
    return (
      <CanvasComponent readOnly={true} content={content}>
        <div className="buttons">
          <button
            ref={(el) => this.openWorkspaceButton = el}
            onClick={this.handleOpenWorkspace}
          >
            Open {section.title} Section
          </button>
        </div>
      </CanvasComponent>
    );
  }

  private handleOpenWorkspace = () => {
    const { db, ui, workspaces } = this.stores;
    const { section } = this.props;
    if (section) {
      // TODO: create section id instead of using type
      const workspace = workspaces.getWorkspaceBySectionId(section.id);
      const done = () => {
        ui.setActiveWorkspaceSectionId(section.id);
        ui.contractAll();
        this.openWorkspaceButton!.disabled = false;
      };

      this.openWorkspaceButton!.disabled = true;
      if (workspace) {
        done();
      }
      else {
        db.createWorkspace(section.id)
          .then(workspaces.addWorkspace)
          .then(done)
          .catch(ui.setError);
      }
    }
  }
}
