import * as React from "react";
import { IBaseProps } from "./base";
import { ClueAppContentComponent } from "../clue/components/clue-app-content";

import "./app-content.sass";

interface IProps extends IBaseProps {}
export const AppContentComponent: React.FC<IProps> = (props) => {
  return (
    <div className="app-content">
      <ClueAppContentComponent {...props} />
    </div>
  );
};
