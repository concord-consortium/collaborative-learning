import { inject, observer } from "mobx-react";
import React from "react";
import clsx from "clsx";
import { BaseComponent, IBaseProps } from "../base";
import { CanvasComponent } from "../document/canvas";
import { SectionModelType } from "../../models/curriculum/section";
import { DocumentContentModelType } from "../../models/document/document-content";
import { SectionToolbar } from "../document/section-toolbar";

import "./problem-panel.scss";

interface IProps extends IBaseProps {
  section?: SectionModelType | null;
}

@inject("stores")
@observer
export class ProblemPanelComponent extends BaseComponent<IProps> {

  public render() {
    const { section } = this.props;

    return (
      <div className="problem-panel">
        {section ? this.renderSection(section) : null}
      </div>
    );
  }

  private renderSection(section: SectionModelType) {
    const {content} = section;
    return (
      <div className="section">
        {content ? this.renderContent(content) : null}
      </div>
    );
  }

  private renderContent(content: DocumentContentModelType) {
    // STANDALONE TODO: in the future standalone add user docs story this should be
    // changed to hide until there is a workspace after the user docs are created
    const hideToolbar = this.stores.ui.standalone && this.stores.user.standaloneAuth;

    return (
        <div key="problem-panel">
          {!hideToolbar &&
          <>
            <SectionToolbar section={this.props.section!} toolbar={this.stores.appConfig.myResourcesToolbar({})} />
            <div className="canvas-separator"/>
          </>
          }
          <div className={clsx("canvas-area", {"hide-toolbar": hideToolbar})}>
            <CanvasComponent
              content={content}
              context="left-nav"
              readOnly={true}
            />
          </div>
        </div>
    );
  }
}
