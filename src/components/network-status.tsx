import classNames from "classnames";
import firebase from "firebase/app";
import { observer } from "mobx-react";
import React, { useState } from "react";
import { UserModelType } from "../models/stores/user";
import { useErrorAlert } from "./utilities/use-error-alert";
import "./network-status.scss";

interface IProps {
  user: UserModelType;
}
export const NetworkStatus = observer(({ user }: IProps) => {
  const { isFirebaseConnected } = user;
  const maxAlertDelay = 60;
  const alertDelaysSec = [1, 5, 10, 30, maxAlertDelay];
  const [alertDelay, setAlertDelay] = useState(alertDelaysSec[0]);
  const [timer, setTimer] = useState(0);
  const [isShowingAlert, setIsShowingAlert] = useState(false);
  const [showAlert, hideAlert] = useErrorAlert({
    className: "network-error",
    title: "Connection Problem",
    content: "There is a problem with your network connection. " +
              "Without an internet connection your work cannot be saved! " +
              "Your connection status is displayed in the header bar above.",
    onClose: () => setIsShowingAlert(false)
  });

  if (isFirebaseConnected) {
    if (timer) {
      clearTimeout(timer);
      setTimer(0);
    }
    if (isShowingAlert) {
      hideAlert();
      setIsShowingAlert(false);
    }
    // reduce the delay if we're back online, but don't make it too short
    // in case we're dealing with intermittent connection issues.
    if (alertDelay > alertDelaysSec[1]) {
      setAlertDelay(alertDelaysSec[1]);
    }
  }

  if (!isFirebaseConnected && !isShowingAlert && !timer) {
    // first detection of a network issue; wait a bit to see if it's for real
    setTimer(window.setTimeout(() => {
      if (!user.isFirebaseConnected) {
        setAlertDelay(alertDelaysSec.find(delay => delay > alertDelay) || maxAlertDelay);
        showAlert();
        setIsShowingAlert(true);
        setTimer(0);
        // increment our internal occurrence count
        user.incrementNetworkStatusAlertCount();
      }
    }, 1000 * alertDelay));
  }

  // clicking on the status "button" resets the timer
  const handleClick = () => {
    setAlertDelay(alertDelaysSec[0]);
    checkFirebaseConnection(user);
  };

  return (
    <div className="network-status" data-testid="network-status">
      <div className={classNames("firebase status", { connected: isFirebaseConnected })}
            onClick={handleClick}>
        {isFirebaseConnected ? "Online" : "Offline!"}
      </div>
    </div>
  );
});

const checkFirebaseConnection = (user: UserModelType) => {
  firebase.database().ref(".info/connected")
    .once("value", snapshot => {
      const isConnected: boolean = snapshot.val();
      user.setIsFirebaseConnected(isConnected);
    });
};
