import { inject, observer } from "mobx-react";
import * as React from "react";
import { BaseComponent, IBaseProps } from "../base";

import "./teacher-support.sass";
import { niceDate } from "../../utilities/time";
import { ENTER } from "@blueprintjs/core/lib/esm/common/keys";
import { TeacherSupportModelType } from "../../models/stores/supports";

interface IProps extends IBaseProps {
  support?: TeacherSupportModelType;
  time: number;
}

interface IState {}

@inject("stores")
@observer
export class TeacherSupport extends BaseComponent<IProps, IState> {

  private inputElem: HTMLInputElement | null;

  public render() {
    const { support } = this.props;

    if (!support) {
      return this.renderNewSupport();
    } else {
      return this.renderExistingSupport(support);
    }
  }

  private renderNewSupport() {
    const { time } = this.props;
    return (
      <div className="teacher-support">
        <div className="date">{niceDate(time)}</div>
        <input className="content" onKeyUp={this.handleEnter} ref={(elem) => this.inputElem = elem}/>
        <div className="send-button" onClick={this.handleSubmit}>Message Class</div>
      </div>
    );
  }

  private renderExistingSupport(support: TeacherSupportModelType) {
    const { time } = this.props;
    const { text } = support;

    return (
      <div className="teacher-support">
        <svg className={`icon icon-delete-tool`} onClick={this.handleDelete(support)}>
          <use xlinkHref={`#icon-delete-tool`} />
        </svg>
        <div className="date">{niceDate(time)}</div>
        <div className="content">
          { text }
        </div>
      </div>
    );
  }

  private handleSubmit = () => {
    const { db } = this.stores;
    if (this.inputElem && this.inputElem.value) {
      db.createSupport(this.inputElem.value);
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
    db.hideSupport(support);
  }

}
