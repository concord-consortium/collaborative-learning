import { observer } from "mobx-react";
import * as React from "react";
import { IBaseProps } from "./base";
import { DocumentModelType } from "../models/document";
import { DocumentContentComponent } from "./document-content";
import { DocumentContentModelType } from "../models/document-content";

import "./canvas.sass";

interface IProps extends IBaseProps {
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
    const {readOnly, content, document, ...others} = this.props;
    const documentContent = document ? document.content : content;
    const hasContent =  documentContent && !documentContent.isEmpty;
    const defaultContent = `${this.props.readOnly ? "NON " : ""}Editable Canvas`;

    if (hasContent) {
      return (
        <DocumentContentComponent readOnly={readOnly} content={documentContent} {...others}>
          {this.props.children}
        </DocumentContentComponent>
      );
    }
    else {
      return defaultContent;
    }
  }
}
