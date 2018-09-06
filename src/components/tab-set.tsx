import { observer } from "mobx-react";
import * as React from "react";

import "./tab-set.sass";

@observer
export class TabSetComponent extends React.Component<{}, {}> {

  public render() {
    return (
      <div className="tabs" role="tablist">
        {this.props.children}
      </div>
    );
  }
}
