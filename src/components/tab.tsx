import { observer } from "mobx-react";
import * as React from "react";

import "./tab.sass";

interface IProps {
  active?: boolean;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

@observer
export class TabComponent extends React.Component<IProps, {}> {

  public render() {
    const {active} = this.props;
    const className = `tab${active ? " active" : ""}`;
    return (
      <div className={className} onClick={this.handleClick}>
        {this.props.children}
      </div>
    );
  }

  private handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (this.props.onClick) {
      this.props.onClick(e);
    }
  }
}
