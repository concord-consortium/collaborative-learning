import React, { useContext } from "react";
import classNames from "classnames";

import LinkGraphIcon from "../../../clue/assets/icons/table/link-graph-icon.svg";
import DuplicateCardIcon from "../assets/duplicate-card-icon.svg";
import DeleteSelectionIcon from "../assets/delete-selection-icon.svg";
import MergeInIcon from "../assets/merge-in-icon.svg";
import { TileToolbarButton } from "../../../components/shared/tile-toolbar-button";
import { DataCardContentModelType } from "../data-card-content";
import { TileModelContext } from "../../../components/tiles/tile-api";
import { ITileProps } from "../../../components/tiles/tile-component";
import { useConsumerTileLinking } from "../../../hooks/use-consumer-tile-linking";
import { useTileDataMerging } from "../../../hooks/use-tile-data-merging";
import { observer } from "mobx-react";

export interface IDataCardToolbarButtonContext {
  currEditAttrId: string;
  onRequestTilesOfType: ITileProps['onRequestTilesOfType'];
  onRequestLinkableTiles?: ITileProps['onRequestLinkableTiles'];
  documentId?: string;
}

interface IDataCardToolbarButtonProps {
  isDisabled?: boolean;
  content: DataCardContentModelType;
  context: IDataCardToolbarButtonContext;
}

export const DuplicateCardButton = ({ content, isDisabled }: IDataCardToolbarButtonProps) => {
  return (
    <TileToolbarButton
      className="duplicate-data-card-button"
      onClick={content.duplicateCard}
      title="Duplicate card"
      isDisabled={isDisabled}
    >
      <DuplicateCardIcon />
    </TileToolbarButton>
  );
};

export const DeleteAttrButton = ({ content, context, isDisabled }: IDataCardToolbarButtonProps) => {
  const handleClick = () => {
    const thisCaseId = content.dataSet.caseIDFromIndex(content.caseIndex);
    if (thisCaseId){
      content.setAttValue(thisCaseId, context.currEditAttrId, "");
    }
  };

  return (
    <TileToolbarButton
      className="delete-value-button"
      onClick={handleClick}
      title="Delete value"
      isDisabled={isDisabled}
    >
      <DeleteSelectionIcon />
    </TileToolbarButton>
  );
};

export const LinkTileButton = observer(function LinkTileButton(
    { content, context, isDisabled }: IDataCardToolbarButtonProps) {
  const hasLinkableRows = content.dataSet.attributes.length > 1;
  // FIXME: since the model could be null we had to add this ! hack
  const model = useContext(TileModelContext)!;
  const { documentId, onRequestTilesOfType, onRequestLinkableTiles } = context;
  const { isLinkEnabled, getLinkIndex, showLinkTileDialog } = useConsumerTileLinking({
    documentId, model, hasLinkableRows, onRequestTilesOfType, onRequestLinkableTiles
  });
  const linkColorClass = `link-color-${getLinkIndex()}`;

  const handleClick = () => {
    showLinkTileDialog && showLinkTileDialog();
  };

  const classes = classNames("link-tile-button", linkColorClass);
  return (
    <TileToolbarButton
      className={classes}
      onClick={handleClick}
      title="Link data card"
      isDisabled={isDisabled || !isLinkEnabled}
    >
      <LinkGraphIcon />
    </TileToolbarButton>
  );
});

export const MergeInButton = observer(function MergeButton({ isDisabled }: IDataCardToolbarButtonProps) {
  const model = useContext(TileModelContext)!;
  const { isMergeEnabled, showMergeTileDialog } = useTileDataMerging({model});

  console.log("MergeInButton", {isDisabled, isMergeEnabled});
  const handleClick = () => {
    showMergeTileDialog && showMergeTileDialog();
  };

  return (
    <TileToolbarButton
      className="merge-data-button"
      onClick={handleClick}
      title="Add Data from..."
      isDisabled={isDisabled || !isMergeEnabled}
    >
      <MergeInIcon />
    </TileToolbarButton>
  );
});
