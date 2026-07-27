import React, { useState } from "react";
import classNames from "classnames";
import { IconButton } from "../../../../components/utilities/icon-button";
import { SerialDevice } from "../../../../models/stores/serial";

import "./dataflow-program-topbar.scss";

interface SerialConnectProps {
  onConnectDevice: (deviceType: "serial" | "spikerbit") => void;
  readOnly: boolean;
  serialDevice: SerialDevice;
}

export const DataflowSerialConnectButton = (props: SerialConnectProps) => {
  const { onConnectDevice, readOnly, serialDevice } = props;
  const [menuOpen, setMenuOpen] = useState(false);

  // Only track physical connection independently of port state when the device provides it.
  const raisesWebSerialConnect = serialDevice.raisesWebSerialConnect;
  const lastMsg = localStorage.getItem("last-connect-message");
  const classes = classNames(
    "icon-serial",
    { "physical-connection": lastMsg === "connect"},
    { "no-physical-connection": lastMsg === "disconnect" && raisesWebSerialConnect},
    serialDevice.serialNodesCount > 0 ? "nodes-in-need" : "no-serial-needed",
    serialDevice.isConnected() ? "connected" : "not-connected"
  );
  function serialMessage(){
    // nodes that use serial, but no device physically connected
    if (lastMsg !== "connect" && serialDevice.serialNodesCount > 0){
      return raisesWebSerialConnect ? "connect a device" : "";
    }
    // physical connection has been made but user action needed
    if (lastMsg === "connect"
        && !serialDevice.isConnected()
        && serialDevice.serialNodesCount > 0
    ){
      return "click to finish connecting";
    }
    else {
      return "";
    }
  }

  const chooseDevice = (deviceType: "serial" | "spikerbit") => {
    setMenuOpen(false);
    onConnectDevice(deviceType);
  };

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
          <button onClick={() => chooseDevice("serial")}>Arduino</button>
          <button onClick={() => chooseDevice("serial")}>micro:bit (radio hub)</button>
          <button onClick={() => chooseDevice("spikerbit")}>Spiker:bit</button>
        </div>
      }
      <div className="serial-message">
        { serialMessage() }
      </div>
    </div>
  );
};
