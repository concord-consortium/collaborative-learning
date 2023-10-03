import React, { useContext } from "react";
import classNames from "classnames";
import { observer } from "mobx-react";

import LinkGraphIcon from "../../../clue/assets/icons/table/link-graph-icon.svg";
import DuplicateCardIcon from "../assets/duplicate-card-icon.svg";
import DeleteSelectionIcon from "../assets/delete-selection-icon.svg";
import { TileToolbarButton } from "../../../components/shared/tile-toolbar-button";
import { DataCardContentModelType } from "../data-card-content";
import { TileModelContext } from "../../../components/tiles/tile-api";
import { MergeInButton } from "../../../components/shared/merge-in-button";
import { useConsumerTileLinking } from "../../../hooks/use-consumer-tile-linking";
import { getTileDataSet } from "../../../models/shared/shared-data-utils";
import { kDataCardTileType } from "../data-card-types";

export interface IDataCardToolbarButtonContext {
  currEditAttrId: string;
}

interface IDataCardToolbarButtonProps {
  isDisabled?: boolean;
  context: IDataCardToolbarButtonContext;
}

function useModelContent() {
  const model = useContext(TileModelContext);
  if (model?.content.type === kDataCardTileType) {
    return model.content as DataCardContentModelType;
  }
}

export const DuplicateCardButton = ({ isDisabled }: IDataCardToolbarButtonProps) => {
  const content = useModelContent();
  return (
    <TileToolbarButton
      className="duplicate-data-card-button"
      onClick={() => content?.duplicateCard()}
      title="Duplicate card"
      isDisabled={isDisabled}
    >
      <DuplicateCardIcon />
    </TileToolbarButton>
  );
};

export const DeleteAttrButton = ({ context, isDisabled }: IDataCardToolbarButtonProps) => {
  const content = useModelContent();

  const handleClick = () => {
    const thisCaseId = content?.dataSet.caseIDFromIndex(content.caseIndex);
    if (thisCaseId){
      content?.setAttValue(thisCaseId, context.currEditAttrId, "");
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

// TODO: a very similar component is used in the table toolbar
// The differences are:
// - the use of the TileToolbarButton
// - the isDisabled property
// - tooltip text
export const LinkTileButton = observer(function LinkTileButton(
    { isDisabled }: IDataCardToolbarButtonProps) {

  // Assume we always have a model
  const model = useContext(TileModelContext)!;
  const dataSet = getTileDataSet(model.content);

  // Currently we only enable the link button if there are 2 or more attributes
  // this is because the linking is generally used for graph and geometry tiles
  // both of them in 2 attributes (in CLUE)
  const hasLinkableRows = dataSet ? dataSet.attributes.length > 1 : false;
  const { isLinkEnabled, showLinkTileDialog } = useConsumerTileLinking({ model, hasLinkableRows });
  const classes = classNames("link-tile-button", );

  const handleClick = () => {
    showLinkTileDialog && showLinkTileDialog();
  };

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

export function DataCardMergeInButton ({ isDisabled }: IDataCardToolbarButtonProps) {
  return <MergeInButton isDisabled={isDisabled} />;
}
