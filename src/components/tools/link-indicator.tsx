import * as React from "react";
import { observer } from "mobx-react";
import { GeometryMetadataModelType } from "../../models/tools/geometry/geometry-content";
import { TableMetadataModelType } from "../../models/tools/table/table-content";
import { findMetadata } from "../../models/tools/tool-types";
import { IconButton } from "../utilities/icon-button";

import "./link-indicator.sass";

interface IProps {
  type: string;
  id: string;
}

@observer
export class LinkIndicatorComponent extends React.Component<IProps>{

  public render() {
    const { id, type } = this.props;
    const metadata = findMetadata(type, id);
    const isGeometry = this.props.type === "Geometry";
    const isTable = this.props.type === "Table";
    const geometryLinkCount = metadata as GeometryMetadataModelType;
    const tableLinkCount = metadata as TableMetadataModelType;
    const linkCount = Math.max(isGeometry ? geometryLinkCount.linkedTableCount
                                          : isTable ? tableLinkCount.linkCount : 0);
    return (
      metadata !== undefined && linkCount > 0
        ? <IconButton icon="link-indicator" key={`link-indicator`} className={`icon-link-indicator`}
                      innerClassName={`link-indicator-icon-${linkCount} link-icon`} />
        : null
    );
  }
}
