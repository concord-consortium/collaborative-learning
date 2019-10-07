import * as React from "react";

import "./section-header.sass";

interface IProps {
  title: string;
  abbreviation: string;
}

export class SectionHeader extends React.Component<IProps, {}> {
  constructor(props: IProps) {
    super(props);
  }

  public render() {
    const { title, abbreviation } = this.props;
    return (
      <div className="row-section-header" data-test="section-header">
        <div className="abbreviation">{abbreviation}</div>
        <div className="title">{title}</div>
      </div>
    );
  }

}
