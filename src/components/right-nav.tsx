import { inject, observer } from "mobx-react";
import * as React from "react";

import "./right-nav.sass";
import { TabComponent } from "./tab";
import { TabSetComponent } from "./tab-set";
import { BaseComponent, IBaseProps } from "./base";
import { MyWorkComponent } from "./my-work";
import { ClassWorkComponent } from "./class-work";
import { ClassLogsComponent } from "./class-logs";

interface IProps extends IBaseProps {
  isGhostUser: boolean;
}

// cf. right-nav.sass: $list-item-scale
const kRightNavItemScale = 0.11;

@inject("stores")
@observer
export class RightNavComponent extends BaseComponent<IProps, {}> {

  public render() {
    const {activeRightNavTab, rightNavExpanded} = this.stores.ui;
    const teacherTabs = ["Class Work", "Class Logs"];
    const studentTabs = ["My Work"].concat(teacherTabs);
    const tabs = this.props.isGhostUser ? teacherTabs : studentTabs;

    return (
      <div className="right-nav">
        <TabSetComponent className={rightNavExpanded ? "expanded" : undefined}>
          {tabs.map((tab) => {
            return (
              <TabComponent
                id={this.getTabId(tab)}
                key={tab}
                active={rightNavExpanded && (activeRightNavTab === tab)}
                onClick={this.handleTabClick(tab)}
              >
                {tab}
              </TabComponent>
            );
          })}
        </TabSetComponent>
        <div
          className={`expanded-area${rightNavExpanded ? " expanded" : ""}`}
          aria-labelledby={this.getTabId(activeRightNavTab)}
          aria-hidden={!rightNavExpanded}
        >
          {this.renderTabContents()}
        </div>
      </div>
    );
  }

  private renderTabContents() {
    const {activeRightNavTab} = this.stores.ui;
    const tabComponents: { [tab: string]: any } = {
      "My Work": MyWorkComponent,
      "Class Work": ClassWorkComponent,
      "Class Logs": ClassLogsComponent
    };
    const _TabComponent = tabComponents[activeRightNavTab];
    if (_TabComponent) {
      return (
        <div className="contents">
          <_TabComponent scale={kRightNavItemScale} />
        </div>
      );
    }
  }

  private handleTabClick = (tab: string) => {
    const { ui } = this.stores;
    return (e: React.MouseEvent<HTMLDivElement>) => {
      if (ui.activeRightNavTab !== tab) {
        ui.setActiveRightNavTab(tab);
        this.stores.ui.toggleRightNav(true);
      }
      else {
        this.stores.ui.toggleRightNav();
      }
    };
  }

  private getTabId(tab: string) {
    return `rightNavTab${tab}`;
  }

}
