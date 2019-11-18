import { inject, observer } from "mobx-react";
import * as React from "react";

import { TabComponent } from "../tab";
import { TabSetComponent } from "../tab-set";
import { LeftNavPanelComponent } from "./left-nav-panel";
import { BaseComponent, IBaseProps } from "../base";

import "./left-nav.sass";
import { Logger, LogEventName } from "../../lib/logger";

interface IProps extends IBaseProps {
  isGhostUser: boolean;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
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
    const { onDragOver, onDrop } = this.props;
    const { problem, ui } = this.stores;
    const { activeSectionIndex, leftNavExpanded } = ui;
    const { sections } = problem;
    const outerClassName = `left-nav${leftNavExpanded ? " expanded" : ""}`;
    const expandedAreaClassName = `expanded-area${leftNavExpanded ? " expanded" : ""}`;
    return (
      <div className={outerClassName} onDragOver={onDragOver} onDrop={onDrop}>
        <TabSetComponent>
          {sections.map((section, sectionIndex) => {
            return (
              <TabComponent
                id={this.getTabId(sectionIndex)}
                key={section.title}
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
    const { problem: {sections}, ui } = this.stores;
    const logParameters = {
      tab_name: sections[sectionIndex].title,
      tab_type: sections[sectionIndex].type
    };
    const logEvent = () => { Logger.log(LogEventName.SHOW_LEFT_TAB, logParameters); };
    return (e: React.MouseEvent<HTMLDivElement>) => {
      if (ui.activeSectionIndex !== sectionIndex) {
        ui.setActiveSectionIndex(sectionIndex);
        ui.toggleLeftNav(true);
        logEvent();
      } else {
        ui.toggleLeftNav();
        ui.leftNavExpanded && logEvent();
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
