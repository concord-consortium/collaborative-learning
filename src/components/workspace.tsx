import * as React from "react"
import { observer } from "mobx-react"

import "./workspace.sass"

interface Props {
}

@observer
export class WorkspaceComponent extends React.Component<Props, {}> {

  render() {
    return (
      <div className="workspace">
        Workspace
      </div>
    )
  }
}