import { inject, observer } from "mobx-react";
import React from "react";
import { BaseComponent, IBaseProps } from "../../../components/base";
import { niceDate } from "../../../utilities/time";
import { TeacherSupportModelType, AudienceModelType, audienceInfo } from "../../../models/stores/supports";
import { getSectionTitle, kAllSectionType } from "../../../models/curriculum/section";
import { createTextSupport } from "../../../models/curriculum/support";

import "./teacher-support.scss";

// SEE: https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/keyCode
const ENTER_KEY_CODE = 13;

interface IProps extends IBaseProps {
  support?: TeacherSupportModelType;
  audience: AudienceModelType;
  time: number;
}

interface IState {}

@inject("stores")
@observer
export class TeacherSupport extends BaseComponent<IProps, IState> {

  private inputElem: HTMLInputElement | null;
  private sectionElem: HTMLSelectElement | null;

  public render() {
    const { support } = this.props;

    if (!support) {
      return this.renderNewSupport();
    } else {
      return this.renderExistingSupport(support);
    }
  }

  private renderNewSupport() {
    const { problem } = this.stores;
    const { time, audience } = this.props;
    const audienceType = audience.type;
    const messageTarget = audienceInfo[audienceType].display;
    const problemSectionTypes = problem.sections.map(section => section.type);
    const sectionTypes = [kAllSectionType, ...problemSectionTypes];
    const sectionOptions = sectionTypes.map(sectionType => {
      return <option key={sectionType} value={sectionType}>{getSectionTitle(sectionType)}</option>;
    });
    return (
      <div className="teacher-support">
        <div className="date">{niceDate(time)}</div>
        <select className="section-dropdown" ref={(elem) => this.sectionElem = elem}>
          {sectionOptions}
        </select>
        <input
          className="content"
          onKeyUp={this.handleEnter}
          ref={(elem) => this.inputElem = elem}
          data-test={`support-input-${audienceType}`}
        />
        <div
          className="send-button"
          onClick={this.handleSubmit}
          data-test={`support-submit-${audienceType}`}
        >
          {`Message ${messageTarget}`}
        </div>
      </div>
    );
  }

  private renderExistingSupport(teacherSupport: TeacherSupportModelType) {
    const { time } = this.props;
    const { support, sectionTargetDisplay } = teacherSupport;

    return (
      <div className="teacher-support" data-test="teacher-support">
        <svg className={`icon icon-delete-tool`} onClick={this.handleDelete(teacherSupport)}>
          <use xlinkHref={`#icon-delete-tool`} />
        </svg>
        <div className="date">{niceDate(time)}</div>
        <div className="section-target">
          { sectionTargetDisplay }
        </div>
        <div className="content">
          { support.content }
        </div>
      </div>
    );
  }

  private handleSubmit = () => {
    const { db } = this.stores;
    const { audience } = this.props;
    const content = this.inputElem && this.inputElem.value;
    const sectionTarget = this.sectionElem && this.sectionElem.value;
    if (this.inputElem && content && sectionTarget) {
      db.createSupport(createTextSupport(content), sectionTarget, audience);
      this.inputElem.value = "";
    }
  };

  private handleEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.keyCode === ENTER_KEY_CODE) {
      this.handleSubmit();
    }
  };

  private handleDelete = (support: TeacherSupportModelType) => () => {
    const { db } = this.stores;
    db.deleteSupport(support);
  };

}
