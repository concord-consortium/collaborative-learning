import { inject, observer } from "mobx-react";
import React from "react";
import { BaseComponent, IBaseProps } from "../base";
import { Tab, Tabs, TabList, TabPanel } from "react-tabs";
import { LeftTabSpec } from "../../models/view/left-tabs";
import { Logger, LogEventName } from "../../lib/logger";

import "react-tabs/style/react-tabs.css";
import "./left-tab-panel.sass";

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
export class LeftTabPanel extends BaseComponent<IProps, IState> {

  constructor(props: IProps) {
    super(props);
    this.state = {
      tabLoadAllowed: {},
    };
  }

  public render() {
    const { tabs } = this.props;
    const { ui } = this.stores;
    const selectedTabIndex = tabs?.findIndex(t => t.tab === ui.activeLeftNavTab);
    return (
      <div className={`left-tab-panel ${ui.leftTabContentShown ? "shown" : ""}`}>
        <Tabs selectedIndex={selectedTabIndex} onSelect={this.handleSelect}>
          <div className="top-row">
            <TabList className="top-tab-list">
              { tabs &&
                tabs.map((tabSpec, i) => {
                  const tabClass = `top-tab tab-${tabSpec.tab} ${selectedTabIndex === i ? "selected" : ""}`;
                  return <Tab key={tabSpec.tab} className={tabClass}>{tabSpec.label}</Tab>;
                })
              }
            </TabList>
            <button className="close-button" onClick={this.handleClose}/>
          </div>
          { tabs && tabs.map((tab, i) => this.renderTabContent(tab, i)) }
        </Tabs>
      </div>
    );
  }

  private renderTabContent = (tabSpec: LeftTabSpec, i: number)  => {
    return (
      <TabPanel key={tabSpec.tab}>
        {tabSpec.label} content
      </TabPanel>
    );
  }

  private handleSelect = (tabIndex: number) => {
    const { tabs } = this.props;
    const { ui } = this.stores;
    if (tabs) {
      const tabSpec = tabs[tabIndex];
      if (ui.activeLeftNavTab !== tabSpec.tab) {
        ui.setActiveLeftNavTab(tabSpec.tab);
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
    ui.toggleLeftTabContent(false);
  }

}
