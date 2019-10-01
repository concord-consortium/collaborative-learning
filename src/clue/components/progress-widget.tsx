import * as React from "react";
import "./progress-widget.sass";

export interface IProgressItem {
  label: string;
  completed: number;
  total: number;
  selected: boolean;
}

interface IProps {
  items: IProgressItem[];
}

interface IState {}

export class ProgressWidget extends React.Component<IProps, IState> {

  public renderItem(progressItem: IProgressItem) {
    const className = progressItem.selected
      ? "section-section selected"
      : "section-section";
    return(
      <div className="section-section">
        <div className="section-circle">{progressItem.label}</div>
        <div className="section-progress">
          <div className="section-current">{progressItem.completed}</div>
          <div className="section-of">of</div>
          <div className="section-total">{progressItem.total}</div>
        </div>
    </div>
    );
  }

  public render() {
    const { items } = this.props;
    return(
      <div className="section-progress">
        <div> Progress </div>
        { items.map(i => this.renderItem(i)) }
      </div>
    );
  }

}
