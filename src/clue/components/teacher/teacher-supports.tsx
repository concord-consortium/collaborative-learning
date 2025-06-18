import { inject, observer } from "mobx-react";
import React from "react";
import { BaseComponent, IBaseProps } from "../../../components/base";
import { TeacherSupportModelType, AudienceModelType, audienceInfo } from "../../../models/stores/supports";
import { TeacherSupport } from "./teacher-support";

import "./teacher-supports.scss";

interface IProps extends IBaseProps {
  supports: TeacherSupportModelType[];
  audience: AudienceModelType;
}

interface IState {}

@inject("stores")
@observer
export class TeacherSupports extends BaseComponent<IProps, IState> {

  public render() {
    const { supports, audience } = this.props;

    return (
      <div className="teacher-supports">
        { this.renderHeader() }
        <TeacherSupport time={new Date().getTime()} audience={audience}/>
          {
            supports
              .map((support, i) => {
                return <TeacherSupport
                  support={support}
                  time={support.authoredTime}
                  audience={audience}
                  key={support.key}/>;
              })
          }
      </div>
    );
  }

  private renderHeader() {
    const { audience } = this.props;
    const audienceType = audience.type;
    const audienceDisplay = audienceInfo[audienceType].display;
    return (
      <div className="dash-header">
        <div className="header-title">{`${audienceDisplay} Supports:`}</div>
        <div className="header-contents">
          <div className="date">Date</div>
          <div className="section">Section</div>
          <div className="content">Message</div>
        </div>
      </div>
    );
  }

}
