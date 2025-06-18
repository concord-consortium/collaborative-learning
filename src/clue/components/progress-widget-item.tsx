import React from "react";
import { IProgressItem } from "./progress-widget";
import "./progress-widget-item.scss";

interface IProps {
  item: IProgressItem;
  selected: boolean;
  setSelectedSectionId: (sectionId: string) => void;
}

interface IState {}

export class ProgressWidgetItem extends React.Component<IProps, IState> {

  public render() {
    const {item, selected} = this.props;
    const circleClassName = `section-circle${selected ? " selected" : ""}`;
    return(
      <div className="progress-widget-item" key={item.label} onClick={this.handleClicked}>
        <div className={circleClassName}>{item.label}</div>
        <div className="section-progress">
          <div className="section-current">{item.completed}</div>
          <div className="section-of">of</div>
          <div className="section-total">{item.total}</div>
        </div>
      </div>
    );
  }

  private handleClicked = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    this.props.setSelectedSectionId(this.props.item.label);
  };

}
