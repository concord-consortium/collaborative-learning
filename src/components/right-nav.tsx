import { inject, observer } from "mobx-react";
import * as React from "react";

import "./right-nav.sass";
import { TabComponent } from "./tab";
import { TabSetComponent } from "./tab-set";
import { BaseComponent, IBaseProps } from "./base";
import { MyWorkComponent } from "./my-work";

interface IProps extends IBaseProps {}

@inject("stores")
@observer
export class RightNavComponent extends BaseComponent<IProps, {}> {

  public render() {
    const {activeRightNavTab, rightNavExpanded} = this.stores.ui;
    const tabs = ["My Work"];

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
            <MyWorkComponent />
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
