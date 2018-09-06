import { observer } from "mobx-react";
import * as React from "react";

import "./tab.sass";

interface IProps {
  id?: string;
  active?: boolean;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

@observer
export class TabComponent extends React.Component<IProps, {}> {

  public render() {
    const {id, active} = this.props;
    const className = `tab${active ? " active" : ""}`;
    return (
      <div id={id} className={className} onClick={this.handleClick} role="tab" aria-selected={active}>
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
