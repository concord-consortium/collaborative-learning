import { observer } from "mobx-react";
import * as React from "react";
import { getSnapshot } from "mobx-state-tree";
import { IBaseProps } from "./base";
import { DocumentModelType } from "../models/document";

import "./canvas.sass";

interface IProps extends IBaseProps {
  readOnly?: boolean;
  document?: DocumentModelType;
}

@observer
export class CanvasComponent extends React.Component<IProps, {}> {

  public render() {
    const {readOnly, document} = this.props;
    return (
      <div className="canvas">
        <div>
          {`${readOnly ? "NON " : ""}Editable Canvas`}
          {document ? this.renderDocument(document) : null}
        </div>
      </div>
    );
  }

  private renderDocument(document: DocumentModelType) {
    const snapshot = getSnapshot(document);
    return (
      <div className="document">
        <pre>{JSON.stringify(snapshot, null, 2)}</pre>
      </div>
    );
  }
}
