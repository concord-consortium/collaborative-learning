import React from "react";
import classNames from "classnames";
import ExpandIndicatorIcon from "../../assets/expand-toggle-icon.svg";

import "./chat-thread-toggle.scss";

interface IProps {
  isThreadExpanded: boolean;
  activeNavTab?: string;
}

export const ChatThreadToggle: React.FC<IProps> = ({ isThreadExpanded, activeNavTab }) => {
  return (
    <div className={classNames(`chat-thread-toggle ${activeNavTab}`, {
          expanded: isThreadExpanded
        })}
        data-testid="chat-thread-toggle">
      <ExpandIndicatorIcon className={`icon-image themed ${activeNavTab}`}/>
    </div>
  );
};
