import { inject, observer } from "mobx-react";
import * as React from "react";
import { BaseComponent, IBaseProps } from "../base";

import "./teacher-supports.sass";
import { TeacherSupportModelType } from "../../models/stores/supports";
import { TeacherSupport } from "./teacher-support";

interface IProps extends IBaseProps {
  supports: TeacherSupportModelType[];
}

interface IState {}

@inject("stores")
@observer
export class TeacherSupports extends BaseComponent<IProps, IState> {

  public render() {
    const { supports } = this.props;

    return (
      <div className="teacher-supports">
        { this.renderHeader() }
        <TeacherSupport time={new Date().getTime()}/>
          {
            // Reverse the supports so the newest ones are first + displayed at the top
            supports.slice()
              .reverse()
              .map((support, i) => {
                return <TeacherSupport support={support} time={support.authoredTime} key={support.key}/>;
              })
          }
      </div>
    );
  }

  private renderHeader() {
    return (
      <div className="dash-header">
        <div className="header-title">Class Supports:</div>
        <div className="header-contents">
          <div className="date">Date</div>
          <div className="section">Section</div>
          <div className="content">Message</div>
        </div>
      </div>
    );
  }

}
