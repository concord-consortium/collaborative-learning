
import { inject, observer } from "mobx-react";
import { BaseComponent, IBaseProps } from "./dataflow-base";
import * as React from "react";

interface IProps extends IBaseProps {}

interface IState {}

@inject("stores")
@observer
export class DeviceListComponent extends BaseComponent<IProps, IState> {
  // XXX: Device depends on group-chooser styling; should be refactored if that UI becomes permanent
  public render() {
    return (
      <div className="join">
        <div className="join-title">Sensor Values</div>
        <div className="join-content">
          {
            this.renderDevices()
          }
        </div>
      </div>
    );
  }

  private renderDevices() {
    const { hubStore } = this.stores;
    const devices: JSX.Element[] = [];
    hubStore.hubs.forEach((hub) => {
      const online = hub.online ? "Online" : "Offline";
      devices.push(
        <div key={hub.hubArn}>
          {`HUB: ${hub.hubDisplayedName} - ${online}`}
        </div>
      );
      hub.hubChannels.forEach((ch) => {
        devices.push(
          <div key={ch.id}>
            {` - ${ch.type}: ${ch.value}`}
          </div>
        );
      });
    });
    return devices;
  }
}
