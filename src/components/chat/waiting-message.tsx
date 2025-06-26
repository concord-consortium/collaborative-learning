import React from "react";
import { observer } from "mobx-react";
import { DocumentContentModelType } from "../../models/document/document-content";

const message = "Ada is evaluating...";

interface IWaitingMessageProps {
  content?: DocumentContentModelType;
}

/**
 * Displays a styled waiting message if content.awaitingAIAnalysis is true.
 */
const WaitingMessage: React.FC<IWaitingMessageProps> = ({ content }) => {
  if (!content?.awaitingAIAnalysis) return null;

  // TODO: awaiting design
  return (
    <p style={{
      textAlign: "center",
      color: "magenta",
      border: "1px solid magenta",
      margin: "10px"
    }}>
      {message}
    </p>
  );
};

export default observer(WaitingMessage);
