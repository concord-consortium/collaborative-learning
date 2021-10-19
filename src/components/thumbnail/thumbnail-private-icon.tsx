import React from "react";
import DocumentPrivateIcon from "../../assets/icons/share/not-share.svg";

import "./thumbnail-private-icon.scss";

export const ThumbnailPrivateIcon: React.FC = () => {
  return (
    <div className="thumbnail-private">
      <DocumentPrivateIcon className="private-icon" />
    </div>
  );
};
