import { inject, observer } from "mobx-react";
import * as React from "react";

import "./left-nav.sass";
import { TabComponent } from "./tab";
import { TabSetComponent } from "./tab-set";
import { BaseComponent, IBaseProps } from "./base";
import { SectionModelType } from "../models/section";

interface IProps extends IBaseProps {}

@inject("stores")
@observer
export class LeftNavComponent extends BaseComponent<IProps, {}> {

  public render() {
    const { problem, ui } = this.stores;
    const { activeSection } = ui;
    const className = `left-nav${ui.leftNavExpanded ? " expanded" : ""}`;
    const { sections } = problem;
    return (
      <div className={className}>
        <TabSetComponent>
          {sections.map((section) => {
            return (
              <TabComponent
                key={section.abbrev}
                active={activeSection === section}
                onClick={this.handleTabClick(section)}
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

  private handleTabClick = (section: SectionModelType) => {
    const { ui } = this.stores;
    return (e: React.MouseEvent<HTMLDivElement>) => {
      if (ui.activeSection !== section) {
        ui.setActiveSection(section);
        this.stores.ui.toggleLeftNav(true);
      }
      else {
        this.stores.ui.toggleLeftNav();
      }
    };
  }
}
