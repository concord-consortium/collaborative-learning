import * as React from "react";
import { IBaseProps } from "./base";
import { ClueHeaderComponent } from "../clue/components/clue-header";
import { DataflowHeaderComponent } from "../dataflow/components/dataflow-header";
import { urlParams } from "../utilities/url-params";
import "./header.sass";

interface IProps extends IBaseProps {
  isGhostUser: boolean;
}

export const HeaderComponent: React.FC<IProps> = (props) => {
  return (
    urlParams.dataflow !== undefined
      ? <DataflowHeaderComponent current="control-panels" {...props} />
      : <ClueHeaderComponent {...props} />
  );
};
