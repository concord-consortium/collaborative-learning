import { observer } from "mobx-react";
import * as React from "react";
import { IBaseProps } from "./base";

import "./canvas.sass";

interface IProps extends IBaseProps {
  readOnly?: boolean;
}

@observer
export class CanvasComponent extends React.Component<IProps, {}> {

  public render() {
    return (
      <div className="canvas">
        {`${this.props.readOnly ? "NON " : ""}Editable Canvas`}
      </div>
    );
  }
}
