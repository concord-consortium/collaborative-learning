import { Provider } from "mobx-react";
import * as React from "react";
import { IBaseProps } from "./base";
import { ClueAppContentComponent } from "../clue/components/clue-app-content";
import { DataflowAppContentComponent } from "../dataflow/components/dataflow-app-content";
import { urlParams } from "../utilities/url-params";
import { IBaseProps as IDataflowProps } from "../dataflow/components/dataflow-base";
import { createStores } from "../dataflow/models/stores/dataflow-stores";

import "./app-content.sass";

interface IProps extends IBaseProps {}
export const AppContentComponent: React.FC<IProps> = (props) => {
  return (
    // &dataflow with no assignment is returned as null
    urlParams.dataflow !== undefined
      ? <Provider stores={createStores()}>
          <DataflowAppContentComponent {...props as IDataflowProps} />
        </Provider>
      : <ClueAppContentComponent {...props} />
  );
};
