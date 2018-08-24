import { observer } from "mobx-react";
import * as React from "react";

import "./workspace.sass";

interface Props {
}

@observer
export class WorkspaceComponent extends React.Component<Props, {}> {

  public render() {
    return (
      <div className="workspace">
        Workspace
      </div>
    );
  }
}
