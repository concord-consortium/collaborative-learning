import { inject, observer } from "mobx-react";
import * as React from "react";
import { DataflowHeaderComponent } from "./dataflow-header";
import { DataflowPanelType } from "./dataflow-types";
import { BaseComponent, IBaseProps } from "../../components/base";
import { DialogComponent } from "../../components/utilities/dialog";

import "./dataflow-app-content.sass";

interface IProps extends IBaseProps {}

interface IState {
  panel: DataflowPanelType;
}

@inject("stores")
@observer
export class DataflowAppContentComponent extends BaseComponent<IProps, IState> {

  public state: IState = { panel: "control-panels" };

  public render() {
    return (
      <div className="dataflow-app-content">
        <DataflowHeaderComponent
          current={this.state.panel}
          onPanelChange={this.handlePanelChange} />
        <div className="single-workspace">
          {this.renderPanel()}
        </div>
        <DialogComponent dialog={this.stores.ui.dialog} />
      </div>
    );
  }

  private handlePanelChange = (panel: DataflowPanelType) => {
    this.setState({ panel });
  }

  private renderPanel() {
    switch (this.state.panel) {
      case "flow-creator":
        return <div>DataFlow: Data Flow Creator</div>;
      case "data-stories":
        return <div>DataFlow: Data Stories</div>;
      case "control-panels":
      default:
        return <div>DataFlow: Control Panels</div>;
    }
  }

}
