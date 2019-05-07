
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
    const { thingStore } = this.stores;
    const devices: JSX.Element[] = [];
    thingStore.things.forEach((thing) => {
      devices.push(
        <div key={thing.thingArn}>
          {`${thing.thingName}: ${thing.value != null ? thing.value  : "-"}`}
        </div>
      );
    });
    return devices;
  }
}
