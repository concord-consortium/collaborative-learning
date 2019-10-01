import * as React from "react";

import "./toggle-group.sass";

type orientation = "horizontal" | "vertical";

interface IToggleChoice {
  label: string;
  onClick?: () => void;
  selected: boolean;
}

interface IProps {
  orientation: orientation;
  options: IToggleChoice[];
}

interface IState {}

export class ToggleGroup extends React.Component<IProps, IState> {

  public renderOption(option: IToggleChoice) {
    const className = option.selected
      ? "toggle-button selected"
      : "toggle-button";
    return(
      <div className={className} onClick={option.onClick}>
        {option.label}
      </div>
    );
  }

  public render() {
    const { options } = this.props;
    return(
      <div className="toggle-group">
        { options.map(o => this.renderOption(o)) }
      </div>
    );
  }

}
