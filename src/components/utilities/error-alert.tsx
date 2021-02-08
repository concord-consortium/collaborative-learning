import React, { useEffect } from "react";
import { IErrorAlertProps, useErrorAlert } from "./use-error-alert";

// Component wrapper for useErrorAlert() for use by class components.
const ErrorAlert: React.FC<IErrorAlertProps> = (props) => {

  const [showAlert, hideAlert] = useErrorAlert(props);

  useEffect(() => {
    showAlert();
    return () => hideAlert();
  }, [hideAlert, showAlert]);

  return null;
};
export default ErrorAlert;
