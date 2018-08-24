import { observer } from "mobx-react";
import * as React from "react";
import { HeaderComponent } from "./header";
import { LearningLogComponent } from "./learning-log";
import { LeftNavComponent } from "./left-nav";
import { MyWorkComponent } from "./my-work";
import { WorkspaceComponent } from "./workspace";

import "./app-container.sass";

@observer
export class AppContainerComponent extends React.Component<{}, {}> {

  public render() {
    return (
      <div className="app-container">
        <HeaderComponent />
        <LeftNavComponent />
        <WorkspaceComponent />
        <LearningLogComponent />
        <MyWorkComponent />
      </div>
    );
  }
}
