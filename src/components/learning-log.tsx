import { observer } from "mobx-react";
import * as React from "react";

import "./learning-log.sass";

interface Props {
}

@observer
export class LearningLogComponent extends React.Component<Props, {}> {

  public render() {
    return (
      <div className="learning-log">
        Learning Log
      </div>
    );
  }
}
