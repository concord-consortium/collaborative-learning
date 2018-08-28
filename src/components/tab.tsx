import { observer } from "mobx-react";
import * as React from "react";

import "./tab.sass";

interface IProps {
  onClick?(e?: React.MouseEvent<HTMLDivElement>): void;
}

@observer
export class TabComponent extends React.Component<IProps, {}> {

  public render() {
    return (
      <div className="tab" onClick={this.handleClick}>
        {this.props.children}
      </div>
    );
  }

  private handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const { onClick } = this.props;
    if (onClick) {
      onClick(e);
    }
  }
}
