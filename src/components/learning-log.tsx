import { inject, observer } from "mobx-react";
import * as React from "react";

import "./learning-log.sass";
import { TabComponent } from "./tab";
import { TabSetComponent } from "./tab-set";
import { BaseComponent, IBaseProps } from "./base";

interface IProps extends IBaseProps {}

@inject("stores")
@observer
export class LearningLogComponent extends BaseComponent<IProps, {}> {

  public render() {
    const className = `learning-log${this.stores.ui.learningLogExpanded ? " expanded" : ""}`;
    const tabs = ["LL", "M", "C"];
    const {activeLearningLogTab, learningLogExpanded} = this.stores.ui;

    return (
      <div className={className}>
        <TabSetComponent>
          {tabs.map((tab) => {
            return (
              <TabComponent
                id={this.getTabId(tab)}
                key={tab}
                active={learningLogExpanded && (activeLearningLogTab === tab)}
                onClick={this.handleTabClick(tab)}
              >
                {tab}
              </TabComponent>
            );
          })}
        </TabSetComponent>
        <div
          className="expanded-area"
          aria-labelledby={this.getTabId(activeLearningLogTab)}
          aria-hidden={!learningLogExpanded}
        >
          <div className="tbd">{activeLearningLogTab}</div>
        </div>
      </div>
    );
  }

  private handleTabClick = (tab: string) => {
    const { ui } = this.stores;
    return (e: React.MouseEvent<HTMLDivElement>) => {
      if (ui.activeLearningLogTab !== tab) {
        ui.setActiveLearningLogTab(tab);
        this.stores.ui.toggleLearningLog(true);
      }
      else {
        this.stores.ui.toggleLearningLog();
      }
    };
  }

  private getTabId(tab: string) {
    return `learningLogTab${tab}`;
  }
}
