import { inject, observer } from "mobx-react";
import * as React from "react";
import { TabComponent } from "../tab";
import { TabSetComponent } from "../tab-set";
import { BaseComponent, IBaseProps } from "../base";
import { HeaderComponent } from "../header";
import { TeacherGroupTabComponent } from "./teacher-group-tab";
import { TeacherStudentTabComponent } from "./teacher-student-tab";

import "./teacher-dashboard.sass";
import { BottomNavComponent } from "../navigation/bottom-nav";
import { RightNavComponent } from "../navigation/right-nav";
import { TeacherSupport } from "./teacher-support";

interface IProps extends IBaseProps {}
interface IState {
  activeTab: TabInfo;
}

type TabType = "Groups" | "Students" | "Supports";

interface TabInfo {
  type: TabType;
  id: string;
}

const tabs: TabInfo[] = [
  {type: "Groups", id: "groups"},
  // TODO: add back tab when support stories (#160073804 && 160073880) are worked on
  // {type: "Supports", id: "supports"}
];

@inject("stores")
@observer
export class TeacherDashboardComponent extends BaseComponent<IProps, IState> {

  public state: IState = {
    activeTab: tabs[0]
  };

  public render() {
    const {supports} = this.stores;
    const {activeTab} = this.state;

    return (
      <div className="teacher-dashboard">
        <HeaderComponent isGhostUser={true} />
        <div className="tabbed-area">
          <div className="tab-contents" aria-labelledby={this.getTabId(activeTab)}>
            { this.renderHeader() }
            <TeacherSupport time={new Date().getTime()}/>
            {
              // Reverse the supports so the newest ones are first + displayed at the top
              supports.teacherSupports.slice()
                .filter(support => !support.deleted)
                .reverse()
                .map((support, i) => {
                  return <TeacherSupport support={support} time={support.authoredTime} key={support.key}/>;
                })
            }
            {this.renderTabContents()}
          </div>
        </div>
        <BottomNavComponent />
        <RightNavComponent isGhostUser={true} />
      </div>
    );
  }

  private renderHeader() {
    return (
      <div className="dash-header">
        <div className="title">Class Supports:</div>
        <div className="header-contents">
          <div className="date">Date</div>
          <div className="section">Section</div>
          <div className="content">Message</div>
        </div>
      </div>
    );
  }

  private renderTabContents() {
    const {activeRightNavTab} = this.stores.ui;
    switch (this.state.activeTab.type) {
      case "Groups":
        return (
          <div className="contents">
            <TeacherGroupTabComponent />
          </div>
        );
      case "Students":
        return (
          <div className="contents">
            <TeacherStudentTabComponent />
          </div>
        );
      case "Supports":
        return (
          <div className="contents">
            TBD: Supports
          </div>
        );
    }
  }

  private handleTabClick = (tab: TabInfo) => {
    return (e: React.MouseEvent<HTMLDivElement>) => {
      this.setState({activeTab: tab});
    };
  }

  private getTabId(tab: TabInfo) {
    return `teacher-dashboard-${tab.id}`;
  }
}
