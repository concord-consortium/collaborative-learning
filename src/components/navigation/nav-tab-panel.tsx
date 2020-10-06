import { inject, observer } from "mobx-react";
import React from "react";
import { BaseComponent, IBaseProps } from "../base";
import { Tab, Tabs, TabList, TabPanel } from "react-tabs";
import { NavTabSpec, ENavTab } from "../../models/view/nav-tabs";
import { Logger, LogEventName } from "../../lib/logger";
import { StudentGroupView } from "../document/student-group-view";
import { ProblemTabContent } from "./problem-tab-content";
import { DocumentTabContent } from "./document-tab-content";
import { SupportBadge } from "./support-badge";

import "react-tabs/style/react-tabs.css";
import "./nav-tab-panel.sass";

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
export class NavTabPanel extends BaseComponent<IProps, IState> {

  constructor(props: IProps) {
    super(props);
    this.state = {
      tabLoadAllowed: {},
    };
  }

  public render() {
    const { tabs } = this.props;
    const { ui, user, supports } = this.stores;
    const selectedTabIndex = tabs?.findIndex(t => t.tab === ui.activeNavTab);
    return (
      <div className={`nav-tab-panel ${ui.navTabContentShown ? "shown" : ""}`}>
        <Tabs selectedIndex={selectedTabIndex} onSelect={this.handleSelectTab} forceRenderTabPanel={true}>
          <div className="top-row">
            <TabList className="top-tab-list">
              { tabs?.map((tabSpec, index) => {
                  const tabClass = `top-tab tab-${tabSpec.tab} ${selectedTabIndex === index ? "selected" : ""}`;
                  return (
                    <React.Fragment key={tabSpec.tab}>
                      <Tab className={tabClass}>{tabSpec.label}</Tab>
                  {(tabSpec.tab === "supports") && <SupportBadge user={user} supports={supports} /> }
                    </React.Fragment>
                  );
                })
              }
            </TabList>
            <button className="close-button" onClick={this.handleClose}/>
          </div>
          { tabs?.map((tabSpec) => {
              return (
                <TabPanel key={tabSpec.tab}>
                  {this.renderTabContent(tabSpec)}
                </TabPanel>
              );
            })
          }
        </Tabs>
      </div>
    );
  }

  private renderTabContent = (tabSpec: NavTabSpec) => {
    switch (tabSpec.tab) {
      case ENavTab.kProblems:
        return this.renderProblems();
      case ENavTab.kStudentWork:
        return <StudentGroupView groupId={this.stores.ui.activeGroupId} setGroupId={this.selectStudentGroup} />;
      case ENavTab.kClassWork:
      case ENavTab.kLearningLog:
      case ENavTab.kMyWork:
      case ENavTab.kSupports:
        return this.renderDocuments(tabSpec);
      default:
        return null;
    }
  }

  private renderDocuments = (tabSpec: NavTabSpec) => {
    return (
      <DocumentTabContent tabSpec={tabSpec}/>
    );
  }

  private renderProblems = () => {
    const { problem } = this.stores;
    const { sections } = problem;
    return (
      <ProblemTabContent sections={sections} />
    );
  }

  private handleSelectTab = (tabIndex: number) => {
    const { tabs } = this.props;
    const { ui } = this.stores;
    if (tabs) {
      const tabSpec = tabs[tabIndex];
      if (ui.activeNavTab !== tabSpec.tab) {
        ui.setActiveNavTab(tabSpec.tab);
        const logParameters = {
          tab_name: tabSpec.tab.toString()
        };
        const logEvent = () => { Logger.log(LogEventName.SHOW_TAB, logParameters); };
        logEvent();
      }
    }
  }

  private selectStudentGroup = (groupId: string) => {
    const { ui } = this.stores;
    ui.setActiveStudentGroup(groupId);
  }

  private handleClose = () => {
    const { ui } = this.stores;
    ui.toggleNavTabContent(false);
  }

}
