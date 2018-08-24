import { observer } from "mobx-react";
import * as React from "react";

import "./left-nav.sass";

interface Props {
}

@observer
export class LeftNavComponent extends React.Component<Props, {}> {

  public render() {
    return (
      <div className="left-nav">
        Left Nav
      </div>
    );
  }
}
