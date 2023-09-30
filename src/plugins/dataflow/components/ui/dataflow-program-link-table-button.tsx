import React from "react";
import classNames from "classnames";
import LinkTableIcon from "../../assets/icons/link-table-icon.svg"; //we may need to change to icon with icon up
import { useFeatureFlag } from "../../../../hooks/use-stores";
import { useConsumerTileLinking } from "../../../../hooks/use-consumer-tile-linking";
import { ITileModel } from "../../../../models/tiles/tile-model";
import { ILinkableTiles, ITileLinkMetadata } from "../../../../models/tiles/tile-link-types";
import { IDataFlowActionHandlers } from "../dataflow-shared";

import "./dataflow-program-link-table-button.scss";

//TODO: this is generally a copy of link-table-button.tsx for Geometry Tile
//consider refactoring -> https://www.pivotaltracker.com/n/projects/2441242/stories/184992684

interface IProps {
  isLinkButtonEnabled?: boolean;
  documentId?: string;
  model: ITileModel;
  onRequestTilesOfType: (tileType: string) => ITileLinkMetadata[];
  onRequestLinkableTiles?: () => ILinkableTiles;
  actionHandlers: IDataFlowActionHandlers;
}

export const DataflowLinkTableButton: React.FC<IProps> = (props: IProps) => {
  const { isLinkButtonEnabled,
          documentId,  model, onRequestTilesOfType, onRequestLinkableTiles, actionHandlers } = props;
  const classes = classNames("link-table-button", { disabled: !isLinkButtonEnabled });

  const { showLinkTileDialog } = useConsumerTileLinking({
                                    hasLinkableRows: true,
                                    model,
                                    onRequestTilesOfType,
                                    onRequestLinkableTiles,
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
