import { inject, observer } from "mobx-react";
import * as React from "react";

import "./left-nav.sass";
import { TabComponent } from "../tab";
import { TabSetComponent } from "../tab-set";
import { LeftNavPanelComponent } from "./left-nav-panel";
import { BaseComponent, IBaseProps } from "../base";

interface IProps extends IBaseProps {
  isGhostUser: boolean;
}

interface IState {
  tabLoadAllowed: { [tab: number]: boolean };
}

@inject("stores")
@observer
export class LeftNavComponent extends BaseComponent<IProps, IState> {

  constructor(props: IProps) {
    super(props);
    this.state = {
      tabLoadAllowed: {}
    };
  }

  public render() {
    const { problem, ui } = this.stores;
    const { activeSectionIndex, leftNavExpanded } = ui;
    const { sections } = problem;
    const activeSection = problem.getSectionByIndex(activeSectionIndex);
    const outerClassName = `left-nav${leftNavExpanded ? " expanded" : ""}`;
    const expandedAreaClassName = `expanded-area${leftNavExpanded ? " expanded" : ""}`;
    return (
      <div className={outerClassName}>
        <TabSetComponent>
          {sections.map((section, sectionIndex) => {
            return (
              <TabComponent
                id={this.getTabId(sectionIndex)}
                key={section.abbrev}
                active={leftNavExpanded && (activeSectionIndex === sectionIndex)}
                onClick={this.handleTabClick(sectionIndex)}
              >
                <span title={section.title}>{section.title}</span>
              </TabComponent>
            );
          })}
        </TabSetComponent>
        <div
          className={expandedAreaClassName}
          aria-labelledby={this.getTabId(activeSectionIndex)}
          aria-hidden={ui.leftNavExpanded}
        >
          {sections.map((section, index) => {
            return (
              this.state.tabLoadAllowed[index]
              ? <div
                  id={this.getContainerId(index)}
                  className={"container " + (activeSectionIndex === index ? "enabled" : "disabled")}
                  key={index}>
                  <LeftNavPanelComponent section={section} isGhostUser={this.props.isGhostUser} key={index} />
                </div>
              : null
            );
          })}

        </div>
      </div>
    );
  }

  private handleTabClick = (sectionIndex: number) => {
    const { ui } = this.stores;
    return (e: React.MouseEvent<HTMLDivElement>) => {
      if (ui.activeSectionIndex !== sectionIndex) {
        ui.setActiveSectionIndex(sectionIndex);
        this.stores.ui.toggleLeftNav(true);
      }
      else {
        this.stores.ui.toggleLeftNav();
      }
      this.updateTabLoadAllowedState(sectionIndex);
    };
  }

  private updateTabLoadAllowedState = (sectionIndex: number) => {
    const tabLoadAllowed = this.state.tabLoadAllowed;
    tabLoadAllowed[sectionIndex] = true;
    this.setState({ tabLoadAllowed });
  }

  private getTabId(sectionIndex: number) {
    return `leftNavTab${sectionIndex}`;
  }

  private getContainerId(sectionIndex: number) {
    return `leftNavContainer${sectionIndex}`;
  }
}
