import React from "react";
import { inject } from "mobx-react";
import classNames from "classnames";
import { BaseComponent } from "../base";
import { SectionType, getSectionInitials, getSectionTitle } from "../../models/curriculum/section";

import "./section-header.sass";

interface IProps {
  type: SectionType;
  documentTypeThemeClass?: string;
}

@inject("stores")
export class SectionHeader extends BaseComponent<IProps> {

  public render() {
    const { type, documentTypeThemeClass } = this.props;
    const initials = getSectionInitials(type);
    const title = getSectionTitle(type);
    const rowSectionHeaderClassNames = classNames("row-section-header", documentTypeThemeClass);
    // id is set to allow for scrolling to section in teacher dashboard
    return (
      <div id={`section_${initials}`} className={rowSectionHeaderClassNames} data-test="section-header"
          onMouseDown={this.handleMouseDown} >
        <div className={`initials ${documentTypeThemeClass}`}>{initials}</div>
        <div className="title">{title}</div>
      </div>
    );
  }

  private handleMouseDown = (e: React.MouseEvent) => {
    this.stores.ui.setSelectedTile();
  }
}
