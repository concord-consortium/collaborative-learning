import { observer } from "mobx-react";
import * as React from "react";

import "./my-work.sass";

@observer
export class MyWorkComponent extends React.Component<{}, {}> {

  public render() {
    return (
      <div className="my-work">
        My Work
      </div>
    );
  }
}
