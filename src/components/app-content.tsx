import * as React from "react";
import { IBaseProps } from "./base";
import { ClueAppContentComponent } from "../clue/components/clue-app-content";
import { DataflowAppContentComponent } from "../dataflow/components/dataflow-app-content";
import { urlParams } from "../utilities/url-params";
import { IBaseProps as IDataflowProps } from "../dataflow/components/dataflow-base";

import "./app-content.sass";

interface IProps extends IBaseProps {}
export const AppContentComponent: React.FC<IProps> = (props) => {
                    // &dataflow with no assignment is returned as null
  const appContent = urlParams.dataflow !== undefined
                      ? <DataflowAppContentComponent {...props as IDataflowProps} />
                      : <ClueAppContentComponent {...props} />;
  return (
    <div className="app-content">
      {appContent}
    </div>
  );
};
