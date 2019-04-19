import { inject, observer } from "mobx-react";
import * as React from "react";
import { Button, ButtonGroup } from "@blueprintjs/core";
import { BaseComponent, IBaseProps } from "../../components/base";
import { DataflowPanelType } from "./dataflow-types";
import "./dataflow-header.sass";

interface IProps extends IBaseProps {
  panel: DataflowPanelType;
  onPanelChange?: (panel: DataflowPanelType) => void;
}

@inject("stores")
@observer
export class DataflowHeaderComponent extends BaseComponent<IProps, {}> {

  public render() {
    const { panel, onPanelChange } = this.props;
    const {appMode, appVersion, db, user} = this.stores;
    const userTitle = appMode !== "authed" ? `Firebase UID: ${db.firebase.userId}` : undefined;

    return (
      <div className="dataflow-header">
        <div className="left">
          DataFlow Application
        </div>
        <div className="middle">
          <ButtonGroup>
            <Button active={panel === "control-panels"}
                    disabled={panel !== "control-panels" && !onPanelChange}
                    onClick={this.handleControlPanelsClick}>
              Control Panels
            </Button>
            <Button active={panel === "flow-creator"}
                    disabled={panel !== "flow-creator" && !onPanelChange}
                    onClick={this.handleFlowCreatorClick}>
              Data Flow Creator
            </Button>
            <Button active={panel === "data-stories"}
                    disabled={panel !== "data-stories" && !onPanelChange}
                    onClick={this.handleDataStoriesClick}>
              Data Stories
            </Button>
          </ButtonGroup>
        </div>
        <div className="right">
          <div className="version">Version {appVersion}</div>
          <div className="user">
            <div className="name" title={userTitle} data-test="user-name">{user.name}</div>
          </div>
        </div>
      </div>
    );
  }

  private handleControlPanelsClick = () => {
    this.props.onPanelChange && this.props.onPanelChange("control-panels");
  }

  private handleFlowCreatorClick = () => {
    this.props.onPanelChange && this.props.onPanelChange("flow-creator");
  }

  private handleDataStoriesClick = () => {
    this.props.onPanelChange && this.props.onPanelChange("data-stories");
  }
}
