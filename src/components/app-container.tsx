import * as React from "react"
import { observer } from "mobx-react"
import { HeaderComponent } from "./header"
import { LeftNavComponent } from "./left-nav"
import { WorkspaceComponent } from "./workspace"
import { LearningLogComponent } from "./learning-log"
import { MyWorkComponent } from "./my-work"

import "./app-container.sass"

interface Props {
}

@observer
export class AppContainerComponent extends React.Component<Props, {}> {

  render() {
    return (
      <div className="app-container">
        <HeaderComponent />
        <LeftNavComponent />
        <WorkspaceComponent />
        <LearningLogComponent />
        <MyWorkComponent />
      </div>
    )
  }
}