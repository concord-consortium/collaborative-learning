import { inject, observer } from "mobx-react";
import React from "react";
import { BaseComponent, IBaseProps } from "../base";
import { Tab, Tabs, TabList, TabPanel } from "react-tabs";
import { ContentTabSpec, EContentTab } from "../../models/view/content-tabs";
import { Logger, LogEventName } from "../../lib/logger";
import { ProblemTabContent } from "./problem-tab-content";
import { DocumentTabContent } from "./document-tab-content";

import "react-tabs/style/react-tabs.css";
import "./content-tab-panel.sass";

interface IProps extends IBaseProps {
  tabs?: ContentTabSpec[];
  isTeacher: boolean;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
}

interface IState {
  tabLoadAllowed: { [tab: number]: boolean };
}

@inject("stores")
@observer
export class ContentTabPanel extends BaseComponent<IProps, IState> {

  constructor(props: IProps) {
    super(props);
    this.state = {
      tabLoadAllowed: {},
    };
  }

  public render() {
    const { tabs } = this.props;
    const { ui } = this.stores;
    const selectedTabIndex = tabs?.findIndex(t => t.tab === ui.activeContentTab);
    return (
      <div className={`content-tab-panel ${ui.contentTabShown ? "shown" : ""}`}>
        <Tabs selectedIndex={selectedTabIndex} onSelect={this.handleSelect} forceRenderTabPanel={true}>
          <div className="top-row">
            <TabList className="top-tab-list">
              { tabs?.map((tabSpec, index) => {
                  const tabClass = `top-tab tab-${tabSpec.tab} ${selectedTabIndex === index ? "selected" : ""}`;
                  return <Tab key={tabSpec.tab} className={tabClass}>{tabSpec.label}</Tab>;
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

  private renderTabContent = (tabSpec: ContentTabSpec) => {
    switch (tabSpec.tab) {
      case EContentTab.kProblems:
        return this.renderProblems();
      case EContentTab.kClassWork:
      case EContentTab.kLearningLog:
      case EContentTab.kMyWork:
      case EContentTab.kStudentWork:
      case EContentTab.kSupports:
        return this.renderDocuments(tabSpec);
      default:
        return null;
    }
  }

  private renderDocuments = (tabSpec: ContentTabSpec) => {
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

  private handleSelect = (tabIndex: number) => {
    const { tabs } = this.props;
    const { ui } = this.stores;
    if (tabs) {
      const tabSpec = tabs[tabIndex];
      if (ui.activeContentTab !== tabSpec.tab) {
        ui.setActiveContentTab(tabSpec.tab);
        const logParameters = {
          tab_name: tabSpec.tab.toString()
        };
        const logEvent = () => { Logger.log(LogEventName.SHOW_LEFT_TAB, logParameters); };
        logEvent();
      }
    }
  }

  private handleClose = () => {
    const { ui } = this.stores;
    ui.toggleContentTab(false);
  }

}
