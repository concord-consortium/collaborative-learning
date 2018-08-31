import { inject, observer } from "mobx-react";
import * as React from "react";

import { IStores } from "../models/stores";
import "./left-nav.sass";
import { TabComponent } from "./tab";
import { TabSetComponent } from "./tab-set";

interface IProps {
  stores?: IStores;
}

@inject("stores")
@observer
export class LeftNavComponent extends React.Component<IProps, {}> {

  get stores() {
    return this.props.stores as IStores;
  }

  public render() {
    const { problem, ui } = this.stores;
    const className = `left-nav${ui.leftNavExpanded ? " expanded" : ""}`;
    const { sections } = problem;
    return (
      <div className={className} onClick={this.handleClick}>
        <TabSetComponent>
          {sections.map((section) => {
            return (
              <TabComponent key={section.abbrev}>
                <span title={section.title}>{section.abbrev}</span>
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
    this.stores.ui.toggleLeftNav();
  }
}
