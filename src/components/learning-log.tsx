import { observer } from "mobx-react";
import * as React from "react";

import "./learning-log.sass";

@observer
export class LearningLogComponent extends React.Component<{}, {}> {

  public render() {
    return (
      <div className="learning-log">
        Learning Log
      </div>
    );
  }
}
