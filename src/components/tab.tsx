import { observer } from "mobx-react";
import React from "react";

import "./tab.scss";

interface IProps {
  id?: string;
  active?: boolean;
  title?: string;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

interface IState {
  hovering: boolean;
}

@observer
export class TabComponent extends React.Component<IProps, IState> {

  constructor(props: IProps) {
    super(props);
    this.state = {
      hovering: false
    };
  }

  public render() {
    const {id, active, title} = this.props;
    const {hovering} = this.state;
    const className = `tab${active ? " active" : ""}${hovering ? " hovering" : ""}`;
    return (
      <div
        id={id}
        className={className}
        onClick={this.handleClick}
        onMouseOver={this.handleMouseOver}
        onMouseOut={this.handleMouseOut}
        role="tab"
        title={title}
        aria-selected={active}
      >
        {this.props.children}
      </div>
    );
  }

  private handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (this.props.onClick) {
      this.props.onClick(e);
    }
  };

  // manual hover state is maintained so that we can set a class to override
  // a child element's style - the :hover pseudo class won't work in this case
  private handleMouseOver = (e: React.MouseEvent<HTMLDivElement>) => {
    this.setState({hovering: true});
  };

  private handleMouseOut = (e: React.MouseEvent<HTMLDivElement>) => {
    this.setState({hovering: false});
  };
}
