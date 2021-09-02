import React from "react";
import { inject } from "mobx-react";
import classNames from "classnames";
import { BaseComponent } from "../base";
import { SectionType, getSectionInitials, getSectionTitle } from "../../models/curriculum/section";

import "./section-header.sass";

interface IProps {
  type: SectionType;
  documentType: string | undefined;
}

@inject("stores")
export class SectionHeader extends BaseComponent<IProps> {

  public render() {
    const { type, documentType } = this.props;
    const initials = getSectionInitials(type);
    const title = getSectionTitle(type);
    const docTypeClass = documentType === "planning" ? "planning-doc" : "";
    const rowSectionHeaderClassNames = classNames("row-section-header", docTypeClass);
    // id is set to allow for scrolling to section in teacher dashboard
    return (
      <div id={`section_${initials}`} className={rowSectionHeaderClassNames} data-test="section-header"
          onMouseDown={this.handleMouseDown} >
        <div className={`initials ${docTypeClass}`}>{initials}</div>
        <div className="title">{title}</div>
      </div>
    );
  }

  private handleMouseDown = (e: React.MouseEvent) => {
    this.stores.ui.setSelectedTile();
  }
}
