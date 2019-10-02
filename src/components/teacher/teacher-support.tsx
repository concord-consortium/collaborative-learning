import { inject, observer } from "mobx-react";
import * as React from "react";
import { BaseComponent, IBaseProps } from "../base";

import { niceDate } from "../../utilities/time";
import { ENTER } from "@blueprintjs/core/lib/esm/common/keys";
import { TeacherSupportModelType, TeacherSupportSectionTarget, AudienceModelType,
  audienceInfo } from "../../models/stores/supports";
import { sectionInfo, allSectionInfo } from "../../models/curriculum/section";
import { createTextSupport } from "../../models/curriculum/support";

import "./teacher-support.sass";

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
    const sectionOptions = (problem.sections).map(section => {
      const sectionType = section.type;
      return <option key={sectionType} value={sectionType}>{sectionInfo[sectionType].title}</option>;
    });
    sectionOptions.unshift(
      <option key={"all"} value={"all"}>{allSectionInfo.title}</option>
    );
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
      db.createSupport(createTextSupport(content), sectionTarget as TeacherSupportSectionTarget, audience);
      this.inputElem.value = "";
    }
  }

  private handleEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.keyCode === ENTER) {
      this.handleSubmit();
    }
  }

  private handleDelete = (support: TeacherSupportModelType) => () => {
    const { db } = this.stores;
    db.deleteSupport(support);
  }

}
