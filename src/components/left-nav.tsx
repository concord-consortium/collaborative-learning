import { inject, observer } from "mobx-react";
import * as React from "react";

import "./left-nav.sass";
import { TabComponent } from "./tab";
import { TabSetComponent } from "./tab-set";
import { BaseComponent, IBaseProps } from "./base";
import { SectionModelType } from "../models/curriculum/section";

interface IProps extends IBaseProps {}

@inject("stores")
@observer
export class LeftNavComponent extends BaseComponent<IProps, {}> {

  public render() {
    const { problem, ui } = this.stores;
    const { activeSectionIndex } = ui;
    const { sections } = problem;
    const activeSection = problem.getSectionByIndex(activeSectionIndex);
    const className = `left-nav${ui.leftNavExpanded ? " expanded" : ""}`;
    return (
      <div className={className}>
        <TabSetComponent>
          {sections.map((section, sectionIndex) => {
            return (
              <TabComponent
                key={section.abbrev}
                active={activeSectionIndex === sectionIndex}
                onClick={this.handleTabClick(sectionIndex)}
              >
                <span title={section.title}>{section.abbrev}</span>
              </TabComponent>
            );
          })}
        </TabSetComponent>
        <div className="expanded-area">
          <div className="tbd">{activeSection ? activeSection.title : ""}</div>
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
}
