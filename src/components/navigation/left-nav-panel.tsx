import { inject, observer } from "mobx-react";
import React from "react";
import { BaseComponent, IBaseProps } from "../base";
import { CanvasComponent } from "../document/canvas";
import { SectionModelType } from "../../models/curriculum/section";
import { DocumentContentModelType } from "../../models/document/document-content";

import "./left-nav-panel.sass";

interface IProps extends IBaseProps {
  section?: SectionModelType | null;
}

@inject("stores")
@observer
export class LeftNavPanelComponent extends BaseComponent<IProps> {

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
          <div className="title">{section.title}</div>
          <div className="separator"/>
        </div>
        {content ? this.renderContent(content) : null}
      </div>
    );
  }

  private renderContent(content: DocumentContentModelType) {
    return (
      <CanvasComponent context="left-nav" readOnly={true} content={content} />
    );
  }

}
