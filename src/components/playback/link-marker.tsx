import React from "react";
import classNames from "classnames";
import LinkIcon from "../../assets/icons/text/link-text-icon.svg";

import "./link-marker.scss";

interface IProps {
  location: number;
  activeNavTab?: string;
  onClick: () => void;
}

// Marks the point in the history a link into the document asked for, so the reader can look
// around and come back to it.
export const LinkMarker: React.FC<IProps> = ({ location, activeNavTab, onClick }) => {
  // 10px is half the width of the marker, it is subtracted to center it
  const style = { left: `calc(${location}% - 10px)` };

  return (
    <div className={classNames("link-marker", activeNavTab)} style={style}>
      <div className="vertical-line" />
      <button type="button" className="link-marker-button"
          aria-label="Linked point in history" title="Linked point in history" onClick={onClick}>
        <LinkIcon aria-hidden="true" />
      </button>
    </div>
  );
};
