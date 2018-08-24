import { observer } from "mobx-react";
import * as React from "react";

import "./my-work.sass";

interface Props {
}

@observer
export class MyWorkComponent extends React.Component<Props, {}> {

  public render() {
    return (
      <div className="my-work">
        My Work
      </div>
    );
  }
}
