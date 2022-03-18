import React from "react";
import { AppContentComponent, IBaseProps } from "../app-config";

interface IProps extends IBaseProps {}
export const AppContentContainerComponent: React.FC<IProps> = (props) => {
  return (
    <div className="app-content">
      <AppContentComponent {...props} />
    </div>
  );
};
