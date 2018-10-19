import { observer } from "mobx-react";
import * as React from "react";
import { IBaseProps } from "./base";
import { DocumentModelType } from "../models/document";
import { DocumentContentComponent } from "./document-content";
import { DocumentContentModelType } from "../models/document-content";

import "./canvas.sass";

export type EditabilityLocation = "north east" | "north west" | "south east" | "south west";

interface IProps extends IBaseProps {
  context: string;
  scale?: number;
  readOnly?: boolean;
  document?: DocumentModelType;
  content?: DocumentContentModelType;
  showEditability?: EditabilityLocation;
}

@observer
export class CanvasComponent extends React.Component<IProps, {}> {

  public render() {
    return (
      <div key="canvas" className="canvas">
        {this.renderContent()}
        {this.renderEditability()}
      </div>
    );
  }

  private renderEditability() {
    const {showEditability, readOnly} = this.props;
    if (showEditability) {
      const iconName = readOnly ? "icon-copy-only" : "icon-edit";
      return (
        <svg key="edit" className={`icon ${iconName} ${showEditability}`}>
          <use xlinkHref={`#${iconName}`} />
        </svg>
      );
    }
    return null;
  }

  private renderContent() {
    const {content, document, ...others} = this.props;
    const documentContent = document ? document.content : content;

    if (documentContent) {
      return (
        <DocumentContentComponent content={documentContent} {...others}>
          {this.props.children}
        </DocumentContentComponent>
      );
    }
    else {
      return null;
    }
  }
}
