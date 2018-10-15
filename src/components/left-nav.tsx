import { inject, observer } from "mobx-react";
import * as React from "react";

import "./left-nav.sass";
import { TabComponent } from "./tab";
import { TabSetComponent } from "./tab-set";
import { LeftNavPanelComponent } from "./left-nav-panel";
import { BaseComponent, IBaseProps } from "./base";

interface IProps extends IBaseProps {
  isGhostUser: boolean;
}

@inject("stores")
@observer
export class LeftNavComponent extends BaseComponent<IProps, {}> {

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
          <LeftNavPanelComponent section={activeSection} isGhostUser={this.props.isGhostUser} />
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
    };
  }

  private getTabId(sectionIndex: number) {
    return `leftNavTab${sectionIndex}`;
  }
}
