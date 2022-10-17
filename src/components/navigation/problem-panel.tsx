import { inject, observer } from "mobx-react";
import React from "react";
import { BaseComponent, IBaseProps } from "../base";
import { CanvasComponent } from "../document/canvas";
import { SectionModelType } from "../../models/curriculum/section";
import { DocumentContentModelType } from "../../models/document/document-content";

import "./problem-panel.sass";

interface IProps extends IBaseProps {
  section?: SectionModelType | null;
}

@inject("stores")
@observer
export class ProblemPanelComponent extends BaseComponent<IProps> {

  public render() {
    // console.log("problem-tab-content.tsx>render()");
    const { section } = this.props;

    return (
      <div className="problem-panel">
        {section ? this.renderSection(section) : null}
      </div>
    );
  }

  private renderSection(section: SectionModelType) {
    // console.log("problem-tab-content.tsx>renderSection()");

    const {content} = section;
    return (
      <div className="section">
        {content ? this.renderContent(content) : null}
      </div>
    );
  }

  private renderContent(content: DocumentContentModelType) {
    // console.log("problem-tab-content.tsx>renderContent()");

    return (
      <CanvasComponent context="left-nav" readOnly={true} content={content}/>
    );
  }

}
