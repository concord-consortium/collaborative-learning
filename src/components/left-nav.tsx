import { inject, observer } from "mobx-react";
import * as React from "react";

import "./left-nav.sass";
import { TabComponent } from "./tab";
import { TabSetComponent } from "./tab-set";
import { LeftNavPanelComponent } from "./left-nav-panel";
import { BaseComponent, IBaseProps } from "./base";
import { SectionModelType } from "../models/curriculum/section";

interface IProps extends IBaseProps {}

@inject("stores")
@observer
export class LeftNavComponent extends BaseComponent<IProps, {}> {

  public render() {
    const { problem, ui } = this.stores;
    const { activeSectionIndex, leftNavExpanded } = ui;
    const { sections } = problem;
    const activeSection = problem.getSectionByIndex(activeSectionIndex);
    const className = `left-nav${leftNavExpanded ? " expanded" : ""}`;
    return (
      <div className={className}>
        <TabSetComponent>
          {sections.map((section, sectionIndex) => {
            return (
              <TabComponent
                id={this.getTabId(sectionIndex)}
                key={section.abbrev}
                active={leftNavExpanded && (activeSectionIndex === sectionIndex)}
                onClick={this.handleTabClick(sectionIndex)}
              >
                <span title={section.title}>{section.abbrev}</span>
              </TabComponent>
            );
          })}
        </TabSetComponent>
        <div
          className="expanded-area"
          aria-labelledby={this.getTabId(activeSectionIndex)}
          aria-hidden={ui.leftNavExpanded}
        >
          <LeftNavPanelComponent section={activeSection} />
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
