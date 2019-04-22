import { inject, observer } from "mobx-react";
import * as React from "react";
import { HeaderComponent } from "./header";
import { IBaseProps } from "./base";
import { ClueAppContentComponent } from "../clue/components/clue-app-content";
import { DataflowAppContentComponent } from "../dataflow/components/dataflow-app-content";
import { urlParams } from "../utilities/url-params";

import "./app-content.sass";

interface IProps extends IBaseProps {}
export const AppContentComponent: React.FC<IProps> = (props) => {
  return (
    // &dataflow with no assignment is returned as null
    urlParams.dataflow !== undefined
      ? <DataflowAppContentComponent {...props} />
      : <ClueAppContentComponent {...props} />
  );
};
