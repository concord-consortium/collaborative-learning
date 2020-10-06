import { inject, observer } from "mobx-react";
import React from "react";
import { BaseComponent, IBaseProps } from "../base";
import { ENavTab, NavTabSpec } from "../../models/view/nav-tabs";
import { Logger, LogEventName } from "../../lib/logger";

import "./nav-tab-buttons.sass";

interface IProps extends IBaseProps {
  tabs?: NavTabSpec[];
  isTeacher: boolean;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
}

interface IState {
  tabLoadAllowed: { [tab: number]: boolean };
}

@inject("stores")
@observer
export class NavTabButtons extends BaseComponent<IProps, IState> {

  constructor(props: IProps) {
    super(props);
    this.state = {
      tabLoadAllowed: {},
    };
  }

  public render() {
    const { tabs } = this.props;
    const { ui, user, supports } = this.stores;

    return (
      <div className={`nav-tab-buttons ${ui.navTabContentShown ? "hidden" : ""}`}>
        { tabs?.map((tabSpec, i) => {
          const tabClass = `nav-tab tab-${tabSpec.tab}`;
          const showNewSupportBadge = tabSpec.tab === "supports"
                                      && user.isStudent
                                      && supports.hasNewTeacherSupports(user.lastSupportViewTimestamp);
          return (
            <div key={tabSpec.tab} className={tabClass} onClick={this.handleTabButtonClick(tabSpec.tab)}>
              {tabSpec.label}
              { showNewSupportBadge && <div className={`support-badge`}></div> }
            </div>
          );
        })
        }
      </div>
    );
  }

  private handleTabButtonClick = (tab: ENavTab) => () => {
    const { ui, user } = this.stores;
    const logParameters = {
      tab_name: tab.toString()
    };
    const logEvent = () => { Logger.log(LogEventName.SHOW_TAB, logParameters); };
    if (ui.activeNavTab !== tab) {
      ui.setActiveNavTab(tab);
      logEvent();
    }
    ui.toggleNavTabContent(true);
    if (tab === "supports") {
      user.setLastSupportViewTimestamp(Date.now());
    }
  }

}
