import React, { useState } from "react";
import classNames from "classnames";
import { observer } from "mobx-react";
import { IconButton } from "../../../../components/utilities/icon-button";
import { SerialDevice } from "../../../../models/stores/serial";
import { useReadOnlyContext } from "../../../../components/document/read-only-context";
import { DeviceChoice, DeviceConnection, kDeviceChoiceLabels, kDeviceChoiceOrder } from "../../model/device-connection";

import "./dataflow-program-topbar.scss";

interface SerialConnectProps {
  onConnectDevice: (choice: DeviceChoice) => void;
  onReconnectDevice: () => void;
  onDisconnectDevice: () => void;
  serialDevice: SerialDevice;
  connection: DeviceConnection;
  needsDevice: boolean;
}

export const DataflowSerialConnectButton = observer(function DataflowSerialConnectButton(
  props: SerialConnectProps
) {
  const { onConnectDevice, onReconnectDevice, onDisconnectDevice, serialDevice, connection, needsDevice } = props;
  const readOnly = useReadOnlyContext();
  const [menuOpen, setMenuOpen] = useState(false);

  // Only track physical connection independently of port state when the device provides it.
  const raisesWebSerialConnect = serialDevice.raisesWebSerialConnect;
  const lastMsg = localStorage.getItem("last-connect-message");
  const classes = classNames(
    "icon-serial",
    { "physical-connection": lastMsg === "connect"},
    { "no-physical-connection": lastMsg === "disconnect" && raisesWebSerialConnect},
    needsDevice ? "nodes-in-need" : "no-serial-needed",
    serialDevice.isConnected() ? "connected" : "not-connected"
  );
  function serialMessage(){
    // nodes that use serial, but no device physically connected
    if (lastMsg !== "connect" && needsDevice){
      return raisesWebSerialConnect ? "connect a device" : "";
    }
    // physical connection has been made but user action needed
    if (lastMsg === "connect"
        && !serialDevice.isConnected()
        && needsDevice
    ){
      return "click to finish connecting";
    }
    else {
      return "";
    }
  }

  const choose = (action: () => void) => {
    setMenuOpen(false);
    action();
  };
  const busy = connection.busyChoice !== undefined;

  return (
    <div className="topbar-icon">
      <IconButton
        icon="serial"
        key="serial"
        onClickButton={() => setMenuOpen(open => !open)}
        title="Connect a device"
        disabled={readOnly}
        className={classes}
      />
      { menuOpen &&
        <div className="serial-device-menu">
          { connection.isConnected
            ? <>
                <button disabled={busy} onClick={() => choose(onReconnectDevice)}>Reconnect</button>
                <button disabled={busy} onClick={() => choose(onDisconnectDevice)}>Disconnect</button>
              </>
            : kDeviceChoiceOrder.map(choice => (
                <button key={choice} disabled={busy} onClick={() => choose(() => onConnectDevice(choice))}>
                  {kDeviceChoiceLabels[choice]}
                </button>
              ))
          }
        </div>
      }
      <div className="serial-message">
        { serialMessage() }
      </div>
    </div>
  );
});
