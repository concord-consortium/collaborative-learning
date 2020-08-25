import { inject, observer } from "mobx-react";
import React from "react";
import { BaseComponent, IBaseProps } from "../base";
import { ELeftTab, LeftTabSpec } from "../../models/view/left-tabs";
import { Logger, LogEventName } from "../../lib/logger";

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
      <div className={`left-tab-buttons ${ui.leftTabContentShown ? "hidden" : ""}`}>
        { tabs &&
          tabs.map((tabSpec, i) => {
            const tabClass = `left-tab tab-${tabSpec.tab}`;
            return (
              <div key={tabSpec.tab} className={tabClass} onClick={this.handleTabButtonClick(tabSpec.tab)}>
                {tabSpec.label}
              </div>
            );
          })
        }
      </div>
    );
  }

  private handleTabButtonClick = (tab: ELeftTab) => () => {
    const { ui } = this.stores;
    const logParameters = {
      tab_name: tab.toString()
    };
    const logEvent = () => { Logger.log(LogEventName.SHOW_LEFT_TAB, logParameters); };
    if (ui.activeLeftNavTab !== tab) {
      ui.setActiveLeftNavTab(tab);
      logEvent();
    }
    ui.toggleLeftTabContent(true);
  }

}
