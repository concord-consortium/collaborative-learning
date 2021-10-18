import React from "react";
import DocumentPlaceholderIcon from "../../assets/document-placeholder-icon.svg";

import "./thumbnail-placeholder-icon.scss";

export const ThumbnailPlaceHolderIcon: React.FC = () => {
  return (
    <div className="thumbnail-placeholder">
      <DocumentPlaceholderIcon className="placeholder-icon" />
    </div>
  );
};
