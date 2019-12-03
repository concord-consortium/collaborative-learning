import * as React from "react";
import { inject } from "mobx-react";
import { BaseComponent } from "../base";
import { SectionType, getSectionInitials, getSectionTitle } from "../../models/curriculum/section";

import "./section-header.sass";

interface IProps {
  type: SectionType;
}

@inject("stores")
export class SectionHeader extends BaseComponent<IProps, {}> {

  public render() {
    const initials = getSectionInitials(this.props.type);
    const title = getSectionTitle(this.props.type);
    // id is set to allow for scrolling to section in teacher dashboard
    return (
      <div id={`section_${initials}`} className="row-section-header" data-test="section-header"
          onMouseDown={this.handleMouseDown} >
        <div className="initials">{initials}</div>
        <div className="title">{title}</div>
      </div>
    );
  }

  private handleMouseDown = (e: React.MouseEvent) => {
    this.stores.ui.setSelectedTile();
  }
}
