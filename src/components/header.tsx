import * as React from "react";
import { IBaseProps } from "./base";
import { ClueHeaderComponent } from "../clue/components/clue-header";
import "./header.sass";

interface IProps extends IBaseProps {
  isGhostUser: boolean;
}

export const HeaderComponent: React.FC<IProps> = (props) => {
  return (
    <ClueHeaderComponent {...props} />
  );
};
