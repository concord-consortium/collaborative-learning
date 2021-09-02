import React from "react";
import { inject } from "mobx-react";
import classNames from "classnames";
import { BaseComponent } from "../base";
import { SectionType, getSectionInitials, getSectionTitle } from "../../models/curriculum/section";

import "./section-header.sass";

interface IProps {
  type: SectionType;
  typeClass?: string;
}

@inject("stores")
export class SectionHeader extends BaseComponent<IProps> {

  public render() {
    const { type, typeClass } = this.props;
    const initials = getSectionInitials(type);
    const title = getSectionTitle(type);
    const rowSectionHeaderClassNames = classNames("row-section-header", typeClass);
    // id is set to allow for scrolling to section in teacher dashboard
    return (
      <div id={`section_${initials}`} className={rowSectionHeaderClassNames} data-test="section-header"
          onMouseDown={this.handleMouseDown} >
        <div className={`initials ${typeClass}`}>{initials}</div>
        <div className="title">{title}</div>
      </div>
    );
  }

  private handleMouseDown = (e: React.MouseEvent) => {
    this.stores.ui.setSelectedTile();
  }
}
