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
  // Half of .link-marker-button's 20px width (link-marker.scss), so the marker centers on its location
  const style = { left: `calc(${location}% - 10px)` };

  return (
    <div className={classNames("link-marker", activeNavTab)} style={style}>
      <div className="vertical-line" />
      <button type="button" className="link-marker-button"
          aria-label="Linked point in history" title="Linked point in history" onClick={onClick}>
        {/* The build's SVG optimizer drops the icon's viewBox, which the icon needs to scale down
            to the marker's size. */}
        <LinkIcon aria-hidden="true" viewBox="0 0 36 35" />
      </button>
    </div>
  );
};
