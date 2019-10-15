import { inject } from "mobx-react";
import * as React from "react";
import "./progress-widget.sass";

import { ProgressWidgetItem } from "./progress-widget-item";
import { BaseComponent } from "../../components/base";

export interface IProgressItem {
  label: string;
  completed: number;
  total: number;
}

interface IProps {
  selectedSectionId: string | null;
  setSelectedSectionId: (sectionId: string) => void;
}

interface IState {
  progressItems: IProgressItem[];
}

@inject("stores")
export class ProgressWidget extends BaseComponent<IProps, IState> {

  constructor(props: IProps) {
    super(props);

    const { problem } = this.stores;
    const { sections } = problem;
    const makeProgressItem = (s: string): IProgressItem => {
      return {
        label: s,
        completed: Math.floor(Math.random() * 12) + 1,
        total: 12
      };
    };
    const progressItems = sections.map(s => makeProgressItem(s.initials));

    this.state = {
      progressItems
    };
  }
  public render() {
    const { selectedSectionId, setSelectedSectionId } = this.props;
    const { progressItems } = this.state;
    return(
      <div className="progress-widget">
        <div className="label"> Progress </div>
        { progressItems.map(item => {
            return (
              <ProgressWidgetItem
                key={item.label}
                item={item}
                selected={item.label === selectedSectionId}
                setSelectedSectionId={setSelectedSectionId}
              />
            );
          })}
      </div>
    );
  }

}
