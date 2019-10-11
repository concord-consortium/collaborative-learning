import * as React from "react";
import { SectionType, getSectionInitials, getSectionTitle } from "../../models/curriculum/section";

import "./section-header.sass";

interface IProps {
  type: SectionType;
}

export class SectionHeader extends React.Component<IProps, {}> {
  constructor(props: IProps) {
    super(props);
  }

  public render() {
    const initials = getSectionInitials(this.props.type);
    const title = getSectionTitle(this.props.type);
    // id is set to allow for scrolling to section in teacher dashboard
    return (
      <div id={`section_${initials}`} className="row-section-header" data-test="section-header">
        <div className="initials">{initials}</div>
        <div className="title">{title}</div>
      </div>
    );
  }

}
