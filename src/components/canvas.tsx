import { observer } from "mobx-react";
import * as React from "react";
import { IBaseProps } from "./base";
import { DocumentModelType } from "../models/document";
import { DocumentContentComponent } from "./document-content";
import { DocumentContentModelType } from "../models/document-content";

import "./canvas.sass";

interface IProps extends IBaseProps {
  context: string;
  readOnly?: boolean;
  document?: DocumentModelType;
  content?: DocumentContentModelType;
}

@observer
export class CanvasComponent extends React.Component<IProps, {}> {

  public render() {
    return (
      <div className="canvas">
        {this.renderContent()}
      </div>
    );
  }

  private renderContent() {
    const {content, document, ...others} = this.props;
    const documentContent = document ? document.content : content;
    const hasContent =  documentContent && !documentContent.isEmpty;

    if (hasContent) {
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
