import { inject, observer } from "mobx-react";
import * as React from "react";

import { IAllStores } from "..";
import { ProblemModelType } from "../models/problem";
import { UIModelType } from "../models/ui";
import "./left-nav.sass";
import { TabComponent } from "./tab";
import { TabSetComponent } from "./tab-set";

interface IInjectedProps {
  ui: UIModelType;
  problem: ProblemModelType;
}

@inject((allStores: IAllStores) => {
  const injected: IInjectedProps = {
    problem: allStores.problem,
    ui: allStores.ui,
  };
  return injected;
})
@observer
export class LeftNavComponent extends React.Component<{}, {}> {

  get injected() {
    return this.props as IInjectedProps;
  }

  public render() {
    const className = `left-nav${this.injected.ui.leftNavExpanded ? " expanded" : ""}`;
    const { sections } = this.injected.problem;
    return (
      <div className={className} onClick={this.handleClick}>
        <TabSetComponent>
          {sections.map((section) => {
            return (
              <TabComponent key={section.shortName}>
                <span title={section.name}>{section.shortName}</span>
              </TabComponent>
            );
          })}
        </TabSetComponent>
        <div className="expanded-area">
          <div className="tbd">TBD</div>
        </div>
      </div>
    );
  }

  private handleClick = () => {
    this.injected.ui.toggleLeftNav();
  }
}
