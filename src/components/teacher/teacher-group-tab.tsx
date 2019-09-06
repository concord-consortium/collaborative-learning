import { inject, observer } from "mobx-react";
import * as React from "react";
import { BaseComponent, IBaseProps } from "../base";
import { TeacherGroupSixPack } from "./teacher-group-six-pack";

import "./teacher-group-tab.sass";

interface IProps extends IBaseProps {}

interface IState {
  selectedGroupId?: string;
}

@inject("stores")
@observer
export class TeacherGroupTabComponent extends BaseComponent<IProps, IState> {
  public state: IState = {};

  public render() {
    return (
      <div className="teacher-group-tab">
        <TeacherGroupSixPack />
      </div>
    );
  }
}
