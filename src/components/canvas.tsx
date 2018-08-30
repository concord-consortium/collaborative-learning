import { observer } from "mobx-react";
import * as React from "react";

import "./canvas.sass";

@observer
export class CanvasComponent extends React.Component<{}, {}> {

  public render() {
    return (
      <div className="canvas">
        Canvas
      </div>
    );
  }
}
