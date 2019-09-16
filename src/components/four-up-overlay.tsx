import * as React from "react";
import { BaseComponent, IBaseProps } from "./base";

import "./four-up-overlay.sass";

interface IProps extends IBaseProps {
  context: string;
  style: any;
  onClick: (context: string) => void;
}

export class FourUpOverlayComponent extends BaseComponent<IProps, {}> {
  public render() {
    return (
      <div
        className="four-up-overlay"
        style={this.props.style}
        onClick={this.handleOnClick}
      />
    );
  }

  private handleOnClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    this.props.onClick(this.props.context);
  }
}
