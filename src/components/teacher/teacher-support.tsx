import { inject, observer } from "mobx-react";
import * as React from "react";
import { BaseComponent, IBaseProps } from "../base";
import { GroupModelType } from "../../models/stores/groups";

import "./teacher-support.sass";

interface IProps extends IBaseProps {
  content?: string;
}

interface IState {}

@inject("stores")
@observer
export class TeacherSupport extends BaseComponent<IProps, IState> {

  public render() {
    const { content } = this.props;

    if (!content) {
      return this.renderNewSupport();
    } else {
      return (
        <div className="teacher-support">
          <svg className={`icon icon-delete-tool`}>
            <use xlinkHref={`#icon-delete-tool`} />
          </svg>
          <div className="date">Dec 18, 2018</div>
          <div className="content">
            { content }
          </div>
        </div>
      );
    }
  }

  private renderNewSupport() {
    return (
      <div className="teacher-support">
        <div className="date">Dec 18, 2018</div>
        <input className="content" />
        <div className="send-button">Message Class</div>
      </div>
    );
  }

}
