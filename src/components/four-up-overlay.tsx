import { inject, observer } from "mobx-react";
import * as React from "react";
import { BaseComponent, IBaseProps } from "./base";
import { DocumentViewMode } from "./teacher/teacher-group-tab";

import "./four-up-overlay.sass";
import { DocumentModelType } from "../models/document/document";

interface IProps extends IBaseProps {
  context: string;
  style: any;
  onClick: (context: string) => void;
  documentViewMode?: DocumentViewMode;
  document?: DocumentModelType;
}

@inject("stores")
@observer
export class FourUpOverlayComponent extends BaseComponent<IProps, {}> {
  public render() {
    return (
      <div
        className="four-up-overlay"
        style={this.props.style}
        onClick={this.handleOverlayClick}
      >
        {this.renderStar()}
      </div>
    );
  }

  private renderStar() {
    const { user } = this.stores;
    const { documentViewMode, document } = this.props;
    if (!document || (documentViewMode !== DocumentViewMode.Published)) {
      return;
    }

    const isStarred = document.isStarredByUser(user.id);
    return (
      <div className="icon-holder" onClick={this.handleStarClick}>
        <svg className={"icon-star " + (isStarred ? "starred" : "")} >
          <use xlinkHref="#icon-outline-star"/>
        </svg>
      </div>
    );
  }

  private handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (this.props.document) {
      this.props.onClick(this.props.context);
    }
  }

  private handleStarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const {user} = this.stores;
    const {document} = this.props;
    e.preventDefault();
    e.stopPropagation();
    if (document) {
      document.toggleUserStar(user.id);
    }
  }

}
