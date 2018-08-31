import { inject, observer } from "mobx-react";
import * as React from "react";

import { IStores } from "../models/stores";
import "./my-work.sass";
import { TabComponent } from "./tab";
import { TabSetComponent } from "./tab-set";

interface IProps {
  stores?: IStores;
}

@inject("stores")
@observer
export class MyWorkComponent extends React.Component<IProps, {}> {

  get stores() {
    return this.props.stores as IStores;
  }

  public render() {
    const { myWorkExpanded } = this.stores.ui;
    const className = `my-work${myWorkExpanded ? " expanded" : ""}`;
    return (
      <div className={className}>
        <TabSetComponent>
          <TabComponent onClick={this.handleClick}>My Work</TabComponent>
        </TabSetComponent>
        <div className="expanded-area">
        <div className="tbd">TBD</div>
        </div>
      </div>
    );
  }

  private handleClick = () => {
    this.stores.ui.toggleMyWork();
  }
}
