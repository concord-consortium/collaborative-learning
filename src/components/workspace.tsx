import { observer } from "mobx-react";
import * as React from "react";

import "./workspace.sass";

@observer
export class WorkspaceComponent extends React.Component<{}, {}> {

  public render() {
    return (
      <div className="workspace" />
    );
  }
}
