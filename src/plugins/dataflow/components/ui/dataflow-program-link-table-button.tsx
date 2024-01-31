import React from "react";
import classNames from "classnames";
import { useFeatureFlag } from "../../../../hooks/use-stores";
import { useConsumerTileLinking } from "../../../../hooks/use-consumer-tile-linking";
import { ITileModel } from "../../../../models/tiles/tile-model";
import { IDataFlowActionHandlers } from "../dataflow-shared";
import { SharedDataSet } from "../../../../models/shared/shared-data-set";
import LinkTableIcon from "../../assets/icons/link-table-icon.svg"; //we may need to change to icon with icon up

import "./dataflow-program-link-table-button.scss";

//TODO: this is generally a copy of link-table-button.tsx for Geometry Tile
//consider refactoring -> https://www.pivotaltracker.com/n/projects/2441242/stories/184992684

interface IProps {
  isLinkButtonEnabled?: boolean;
  documentId?: string;
  model: ITileModel;
  actionHandlers: IDataFlowActionHandlers;
}

export const DataflowLinkTableButton: React.FC<IProps> = (props: IProps) => {
  const { isLinkButtonEnabled, documentId,  model, actionHandlers } = props;
  const classes = classNames("link-table-button", { disabled: !isLinkButtonEnabled });

  const { showLinkTileDialog } = useConsumerTileLinking({
                                    hasLinkableRows: true,
                                    model,
                                    shareType: SharedDataSet,
                                    onLinkTile: actionHandlers.handleRequestTableLink,
                                    onUnlinkTile: actionHandlers.handleRequestTableUnlink
                                  });

  const handleClick = (e: React.MouseEvent) => {
    isLinkButtonEnabled && documentId && showLinkTileDialog();
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
