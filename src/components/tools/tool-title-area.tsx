import React, { ReactElement } from "react";

interface IProps {
  contents: ReactElement
}

export const ToolTitleArea: React.FC<IProps> = ({ contents }: IProps) => {
  return (
    <div className="title-area-wrapper" key="title-area">
      <div className="title-area">
        { contents }
      </div>
    </div>
  );
};
