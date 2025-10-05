import React from "react";
import { AppContentComponent, IBaseProps } from "../app-config";
import { useAuthoringPreview } from "../authoring/hooks/use-authoring-preview";

interface IProps extends IBaseProps {}
export const AppContentContainerComponent: React.FC<IProps> = (props) => {

  // sets up heartbeat to keep authoring preview windows in sync
  useAuthoringPreview();

  return (
    <div className="app-content">
      <AppContentComponent {...props} />
    </div>
  );
};
