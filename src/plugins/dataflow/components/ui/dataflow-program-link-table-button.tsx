import React from "react";
import classNames from "classnames";
import LinkTableIcon from "../../assets/icons/link-table-icon.svg"; //we may need to change to icon with icon up
import { useFeatureFlag } from "../../../../hooks/use-stores";
import { useTableLinkingDataFlow } from "../use-table-linking-dataflow";
import { ITileModel } from "../../../../models/tiles/tile-model";
import { ITileLinkMetadata } from "../../../../models/tiles/table-link-types";
import { IDataFlowActionHandlers } from "../dataflow-shared";

import "./dataflow-program-link-table-button.scss";

//TODO: this is generally a copy of link-table-button.tsx for Geometry Tile
//consider refactoring -> https://www.pivotaltracker.com/n/projects/2441242/stories/184992684

interface IProps {
  isLinkButtonEnabled?: boolean;
  documentId?: string;
  model: ITileModel;
  onRequestTilesOfType: (tileType: string) => ITileLinkMetadata[];
  actionHandlers: IDataFlowActionHandlers;
}

export const DataflowLinkTableButton: React.FC<IProps> = (props: IProps) => {
  const { isLinkButtonEnabled,
          documentId,  model, onRequestTilesOfType, actionHandlers } = props;
  const classes = classNames("link-table-button", { disabled: !isLinkButtonEnabled });

  const { showLinkTableDialog } = useTableLinkingDataFlow({
                                    documentId,
                                    model,
                                    onRequestTilesOfType,
                                    actionHandlers
                                  });

  const handleClick = (e: React.MouseEvent) => {
    isLinkButtonEnabled && documentId && showLinkTableDialog();
    e.stopPropagation();
  };

  return useFeatureFlag("DataflowLinkedTables")
          ? <div
              key="table-link-button"
              className={classes}
              data-testid="table-link-button"
              onClick={handleClick}
            >
              <LinkTableIcon />
            </div>
          : null;
};
