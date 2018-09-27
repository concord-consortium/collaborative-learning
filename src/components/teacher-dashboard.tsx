import { inject, observer } from "mobx-react";
import * as React from "react";
import { BaseComponent, IBaseProps } from "./base";

import "./teacher-dashboard.sass";

interface IProps extends IBaseProps {}

@inject("stores")
@observer
export class TeacherDashboardComponent extends BaseComponent<IProps, {}> {

  public render() {
    return (
      <div className="teacher-dashboard">
        TDB: Teacher Dashboard
      </div>
    );
  }
}
