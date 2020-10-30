import React from "react";

import "./empty-image-prompt.scss";

interface IProps {
  show?: boolean;
}
export const EmptyImagePrompt: React.FC<IProps> = ({ show }) => {
  return show
    ? (
        <div className="image-prompt-container">
          <div className="image-prompt">
            Upload or drag image here.
          </div>
        </div>
      )
    : null;
};
