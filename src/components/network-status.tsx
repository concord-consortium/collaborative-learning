import classNames from "classnames";
import firebase from "firebase/app";
import { observer } from "mobx-react";
import React, { useCallback, useState } from "react";
import { LogEventName, Logger } from "../lib/logger";
import { UserModelType } from "../models/stores/user";
import { useErrorAlert } from "./utilities/use-error-alert";
import "./network-status.scss";

interface IProps {
  user: UserModelType;
}
export const NetworkStatus = observer(({ user }: IProps) => {
  const { isFirebaseConnected, isSavingDocuments } = user;
  // connection alert
  const maxConnectionAlertDelay = 60;
  const connectionAlertDelaysSec = [1, 5, 10, 30, maxConnectionAlertDelay];
  const [alertDelay, setAlertDelay] = useState(connectionAlertDelaysSec[0]);
  const [connectionTimer, setConnectionTimer] = useState(0);
  const [isShowingConnectionAlert, setIsShowingConnectionAlert] = useState(false);
  const [showConnectionAlert, hideConnectionAlert] = useErrorAlert({
    className: "network-error",
    title: "Connection Problem",
    content: "There is a problem with your network connection. " +
              "Without an internet connection your work cannot be saved! " +
              "Your connection status is displayed in the header bar above.",
    onClose: () => setIsShowingConnectionAlert(false)
  });
  // saving alert
  const kSavingAlertDelay = 30;
  const [savingTimer, setSavingTimer] = useState(0);
  const [isShowingSavingAlert, setIsShowingSavingAlert] = useState(false);
  const handleSaveTimerExpiration = useCallback((_user: UserModelType, showAlert: () => void) => {
    // only show saving alert if we're connected; offline alert takes precedence
    if (_user.isFirebaseConnected && !_user.isSavingDocuments) {
      showAlert();
      setIsShowingSavingAlert(true);
      setSavingTimer(0);
      // since the Logger currently has no retry this won't be logged on a general network
      // disconnect but might be helpful to know if saving is failing independently
      Logger.log(LogEventName.INTERNAL_SAVE_STATUS_ALERTED);
    }
    // reset timer so if we come online but still aren't saving we can put up alert
    else if (!_user.isSavingDocuments) {
      setSavingTimer(window.setTimeout(() => {
        handleSaveTimerExpiration(_user, showAlert);
      }, kSavingAlertDelay * 1000));
    }
  }, []);
  const [showSavingAlert, hideSavingAlert] = useErrorAlert({
    className: "network-error",
    title: "Saving Problem",
    content: "There is a problem with saving your documents. " +
              "Please reload the page or re-launch the activity from the learn portal. " +
              "If the problem persists contact your teacher or administrator.",
    onClose: () => {
      setIsShowingSavingAlert(false);
      // if we're still not saving when the user closes the alert, reset to show it again
      if (!user.isSavingDocuments) {
        setSavingTimer(window.setTimeout(() => {
          handleSaveTimerExpiration(user, showSavingAlert);
        }, kSavingAlertDelay * 1000));
      }
    }
  });

  if (isSavingDocuments) {
    if (savingTimer) {
      clearTimeout(savingTimer);
      setSavingTimer(0);
    }
    if (isShowingSavingAlert) {
      hideSavingAlert();
      setIsShowingSavingAlert(false);
    }
  }

  if (isFirebaseConnected) {
    if (connectionTimer) {
      clearTimeout(connectionTimer);
      setConnectionTimer(0);
    }
    if (isShowingConnectionAlert) {
      hideConnectionAlert();
      setIsShowingConnectionAlert(false);
    }
    // reduce the delay if we're back online, but don't make it too short
    // in case we're dealing with intermittent connection issues.
    if (alertDelay > connectionAlertDelaysSec[1]) {
      setAlertDelay(connectionAlertDelaysSec[1]);
    }

    if (!isSavingDocuments && !isShowingSavingAlert && !savingTimer) {
      showSavingAlert();
      setIsShowingSavingAlert(true);
    }
  }

  if (!isFirebaseConnected && !isShowingConnectionAlert && !connectionTimer) {
    // first detection of a network issue; wait a bit to see if it's for real
    setConnectionTimer(window.setTimeout(() => {
      if (!user.isFirebaseConnected) {
        setAlertDelay(connectionAlertDelaysSec.find(delay => delay > alertDelay) || maxConnectionAlertDelay);
        showConnectionAlert();
        setIsShowingConnectionAlert(true);
        setConnectionTimer(0);
        // since the Logger currently has no retry this won't be logged on a general network
        // disconnect but might be helpful to know if only Firebase disconnected
        Logger.log(LogEventName.INTERNAL_NETWORK_STATUS_ALERTED);
      }
    }, 1000 * alertDelay));
  }

  // clicking on the status "button" resets the timer
  const handleClick = () => {
    setAlertDelay(connectionAlertDelaysSec[0]);
    checkFirebaseConnection(user);
  };

  return (
    <div className="network-status" data-testid="network-status">
      <div className={classNames("firebase status", { connected: isFirebaseConnected, saving: isSavingDocuments })}
            onClick={handleClick}>
        {isFirebaseConnected && isSavingDocuments
          ? "Saving"
          : isFirebaseConnected ? "Not Saving!" : "Offline!"}
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
