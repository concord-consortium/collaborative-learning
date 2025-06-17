import { observer } from "mobx-react";
import React from "react";

import "./tab-set.scss";

interface IProps {
  className?: string;
}

@observer
export class TabSetComponent extends React.Component<IProps> {

  public render() {
    const className = `tabs${this.props.className ? ` ${this.props.className}` : ""}`;
    return (
      <div className={className} role="tablist">
        {this.props.children}
      </div>
    );
  }
}
