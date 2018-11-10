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
    const tabs = this.props.isGhostUser ? ["Class Work", "Class Logs"] : ["My Work", "Class Work", "Class Logs"];

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
    switch (activeRightNavTab) {
      case "My Work":
        return (
          <div className="contents">
            <MyWorkComponent scale={kRightNavItemScale} />
          </div>
        );
      case "Class Work":
        return (
          <div className="contents">
            <ClassWorkComponent scale={kRightNavItemScale} />
          </div>
        );
      case "Class Logs":
        return (
          <div className="contents">
            <ClassLogsComponent scale={kRightNavItemScale} />
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
