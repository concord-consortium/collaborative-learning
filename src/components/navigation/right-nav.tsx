import { inject, observer } from "mobx-react";
import * as React from "react";

import "./right-nav.sass";
import { TabComponent } from "../tab";
import { TabSetComponent } from "../tab-set";
import { BaseComponent, IBaseProps } from "../base";
import { MyWorkComponent } from "../thumbnail/my-work";
import { ClassWorkComponent } from "../thumbnail/class-work";
import { ClassLogsComponent } from "../thumbnail/class-logs";

interface IProps extends IBaseProps {
  isGhostUser: boolean;
}

interface IState {
  componentHeight: number;
}

// cf. right-nav.sass: $list-item-scale
const kRightNavItemScale = 0.11;
const kHeaderHeight = 55;
const kTabHeight = 35;

@inject("stores")
@observer
export class RightNavComponent extends BaseComponent<IProps, IState> {

  constructor(props: IProps) {
    super(props);
    this.state = {
      componentHeight: 0,
    };
  }

  public componentDidMount() {
    this.handleSetHeight();
    window.addEventListener("resize", this.handleSetHeight);
  }

  public componentWillUnmount() {
    window.removeEventListener("resize", this.handleSetHeight);
  }

  public render() {
    const {activeRightNavTab, rightNavExpanded} = this.stores.ui;
    const teacherTabs = ["Class Work", "Class Logs"];
    const studentTabs = ["My Work"].concat(teacherTabs);
    const tabs = this.props.isGhostUser ? teacherTabs : studentTabs;
    const expandedStyle = {height: this.state.componentHeight};
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
          style={expandedStyle}
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

  private handleSetHeight = () => {
    const app = document.getElementById("app");
    if (app) {
      const appHeight = app.getBoundingClientRect().height;
      this.setState({
        componentHeight: appHeight - kHeaderHeight - (kTabHeight / 2)
      });
    }
  }

}
