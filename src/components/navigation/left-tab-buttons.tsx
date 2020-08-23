import { inject, observer } from "mobx-react";
import React from "react";
import { BaseComponent, IBaseProps } from "../base";
import { ELeftTab, LeftTabSpec } from "../../models/view/left-tabs";

import "./left-tab-buttons.sass";

interface IProps extends IBaseProps {
  tabs?: LeftTabSpec[];
  isGhostUser: boolean;
  isTeacher: boolean;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
}

interface IState {
  tabLoadAllowed: { [tab: number]: boolean };
}

@inject("stores")
@observer
export class LeftTabButtons extends BaseComponent<IProps, IState> {

  constructor(props: IProps) {
    super(props);
    this.state = {
      tabLoadAllowed: {},
    };
  }

  public render() {
    const { tabs } = this.props;
    const { ui } = this.stores;
    return (
      <div className={`left-tab-buttons ${!ui.leftTabButtonsShown ? "hidden" : ""}`}>
        { tabs &&
          tabs.map((tabWrapper, i) => {
            const tabClass = `left-tab tab-${tabWrapper.tab}`;
            return (
              <div key={`index-${i}`} className={tabClass} onClick={this.handleTabButtonClick(tabWrapper.tab)}>
                {tabWrapper.label}
              </div>
            );
          })
        }
      </div>
    );
  }

  private handleTabButtonClick = (tab: ELeftTab) => () => {
    const { ui } = this.stores;
    if (ui.activeLeftNavTab !== tab) {
      ui.setActiveLeftNavTab(tab);
    }
    ui.toggleLeftTabButtons(false);
  }

}
