import React from "react";
import classNames from "classnames";
import { IconButton } from "../../../../components/utilities/icon-button";
import { SerialDevice } from "../../../../models/stores/serial";

import "./dataflow-program-topbar.scss";

interface SerialConnectProps {
  onSerialRefreshDevices: () => void;
  readOnly: boolean;
  serialDevice: SerialDevice;
}

export const DataflowSerialConnectButton = (props: SerialConnectProps) => {
  const { onSerialRefreshDevices, readOnly, serialDevice } = props;

  // Of the boards tested, only authentic Arduinos (usbProductId === 67) raise the browser `connect` event
  // Which we use to track physical connection independently of port state
  // So we only warn of a lack of physical connection when using an known board
  const knownBoard = serialDevice.deviceInfo?.usbProductId === 67;
  const lastMsg = localStorage.getItem("last-connect-message");
  const classes = classNames(
    "icon-serial",
    { "physical-connection": lastMsg === "connect" },
    { "no-physical-connection": lastMsg === "disconnect" && knownBoard },
    serialDevice.serialNodesCount > 0 ? "nodes-in-need" : "no-serial-needed",
    serialDevice.hasPort() ? "has-port" : "no-port"
  );
  function serialMessage(){
    // nodes that use serial, but no device physically connected
    if (lastMsg !== "connect" && serialDevice.serialNodesCount > 0){
      return knownBoard ? "connect a device" : "";
    }
    // physical connection has been made but user action needed
    if (lastMsg === "connect"
        && !serialDevice.hasPort()
        && serialDevice.serialNodesCount > 0
    ){
      return "click to finish connecting";
    }
    else {
      return "";
    }
  }

  return (
    <div className="topbar-icon">
      {<IconButton
        icon="serial"
        key="serial"
        onClickButton={onSerialRefreshDevices}
        title="Refresh Serial Connection"
        disabled={readOnly}
        className={classes}
      />}
      <div className="serial-message">
        { serialMessage() }
      </div>
    </div>
  );
};
