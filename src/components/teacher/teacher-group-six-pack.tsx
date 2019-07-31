import * as React from "react";
import { BaseComponent, IBaseProps } from "../base";

import "./teacher-group-six-pack.sass";

interface IProps extends IBaseProps {
}

interface IState {
}

export class TeacherGroupSixPack extends BaseComponent<IProps, IState> {

  public render() {
    return (
      <div className="teacher-group-six-pack">
        <div className="group-0-0">
          top-left
        </div>
        <div className="group-0-1">
          top-center
        </div>
        <div className="group-0-2">
          top-right
        </div>
        <div className="group-1-0">
          bottom-left
        </div>
        <div className="group-1-1">
          bottom-center
        </div>
        <div className="group-1-2">
          bottom-right
        </div>
      </div>
    );
  }

}
