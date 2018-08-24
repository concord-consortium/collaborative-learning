import { observer } from "mobx-react";
import * as React from "react";

import "./left-nav.sass";

@observer
export class LeftNavComponent extends React.Component<{}, {}> {

  public render() {
    return (
      <div className="left-nav">
        Left Nav
      </div>
    );
  }
}
