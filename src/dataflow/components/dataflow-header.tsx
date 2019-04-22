import { inject, observer } from "mobx-react";
import * as React from "react";
import { Button, ButtonGroup } from "@blueprintjs/core";
import { BaseComponent, IBaseProps } from "../../components/base";
import { DataflowPanelType } from "./dataflow-types";
import "./dataflow-header.sass";

interface IProps extends IBaseProps {
  current: DataflowPanelType;
  onPanelChange?: (panel: DataflowPanelType) => void;
}

interface IPanelButtonProps extends IProps {
  label: string;
  panel: DataflowPanelType;
}

const PanelButton: React.FC<IPanelButtonProps> = (props) => {
  const { current, onPanelChange, label, panel } = props;
  const handlePanelChange = () => { onPanelChange && onPanelChange(panel); };
  return (
    <Button active={current === panel}
            disabled={current !== panel && !onPanelChange}
            onClick={handlePanelChange}>
      {label}
    </Button>
  );
};

@inject("stores")
@observer
export class DataflowHeaderComponent extends BaseComponent<IProps, {}> {

  public render() {
    const {appMode, appVersion, db, user} = this.stores;
    const userTitle = appMode !== "authed" ? `Firebase UID: ${db.firebase.userId}` : undefined;

    return (
      <div className="dataflow-header">
        <div className="left">
          DataFlow Application
        </div>
        <div className="middle">
          <ButtonGroup>
            <PanelButton label="Control Panels" panel="control-panels" {...this.props} />
            <PanelButton label="Data Flow Creator" panel="flow-creator" {...this.props} />
            <PanelButton label="Data Stories" panel="data-stories" {...this.props} />
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
}
