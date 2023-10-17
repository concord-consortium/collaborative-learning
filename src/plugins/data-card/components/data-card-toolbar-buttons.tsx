import React, { useContext } from "react";
import classNames from "classnames";
import { observer } from "mobx-react";

import LinkGraphIcon from "../../../clue/assets/icons/table/link-graph-icon.svg";
import DuplicateCardIcon from "../assets/duplicate-card-icon.svg";
import DeleteSelectionIcon from "../assets/delete-selection-icon.svg";
import ViewDataAsGraphIcon from "../../../assets/icons/view-data-as-graph-icon.svg";
import { TileToolbarButton } from "../../../components/shared/tile-toolbar-button";
import { DataCardContentModelType } from "../data-card-content";
import { TileModelContext } from "../../../components/tiles/tile-api";
import { MergeInButton } from "../../../components/shared/merge-in-button";
import { useConsumerTileLinking } from "../../../hooks/use-consumer-tile-linking";
import { getTileDataSet } from "../../../models/shared/shared-data-utils";
import { kDataCardTileType } from "../data-card-types";
import { DataCardToolbarContext } from "../data-card-toolbar-context";
import { kGraphTileType } from "../../graph/graph-defs";

function useModelContent() {
  const model = useContext(TileModelContext);
  if (model?.content.type === kDataCardTileType) {
    return model.content as DataCardContentModelType;
  }
}

function useCardAction() {
  const content = useModelContent();
  const numAttributes = content?.attributes.length || 0;
  const isDisabled = numAttributes < 1;

  return {content, isDisabled};
}

export const DuplicateCardButton = () => {
  const {content, isDisabled} = useCardAction();

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

export const DeleteAttrButton = () => {
  const content = useModelContent();
  const context = useContext(DataCardToolbarContext);
  const isEditingValue = !!context?.currEditAttrId && context?.currEditFacet === "value";

  const handleClick = () => {
    const thisCaseId = content?.dataSet.caseIDFromIndex(content.caseIndex);
    if (thisCaseId && context){
      content?.setAttValue(thisCaseId, context.currEditAttrId, "");
    }
  };

  return (
    <TileToolbarButton
      className="delete-value-button"
      onClick={handleClick}
      title="Delete value"
      isDisabled={!isEditingValue}
    >
      <DeleteSelectionIcon />
    </TileToolbarButton>
  );
};


interface ILinkTileButtonProps {
  isDisabled?: boolean
}
// TODO: a very similar component is used in the table toolbar
// The differences are:
// - the use of the TileToolbarButton
// - the isDisabled property
// - tooltip text
const LinkTileButton = observer(function LinkTileButton(
    { isDisabled }: ILinkTileButtonProps) {

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

interface ILinkGraphButtonProps {
  isDisabled?: boolean;
}
export const LinkGraphButton = observer(function LinkGraphButton(
  { isDisabled }: ILinkGraphButtonProps) {

  // Assume we always have a model
  const model = useContext(TileModelContext)!;
  const dataSet = getTileDataSet(model.content);

  // Currently we only enable the link button if there are 2 or more attributes
  // this is because the linking is generally used for graph and geometry tiles
  // both of them in 2 attributes (in CLUE)
  const hasLinkableRows = dataSet ? dataSet.attributes.length > 1 : false;

  const { isLinkEnabled, showLinkTileDialog }
    = useConsumerTileLinking({ model, hasLinkableRows, onlyType: kGraphTileType });
  const classes = classNames("link-graph-button", );

  const handleClick = () => {
    showLinkTileDialog && showLinkTileDialog();
  };

  return (
    <TileToolbarButton
      className={classes}
      onClick={handleClick}
      title="View Data as Graph"
      isDisabled={isDisabled || !isLinkEnabled}
    >
      <ViewDataAsGraphIcon/>
    </TileToolbarButton>
  );
});

export function DataCardLinkTileButton () {
  const { isDisabled } = useCardAction();

  return <LinkTileButton isDisabled={isDisabled} />;
}

export function DataCardMergeInButton () {
  const { isDisabled } = useCardAction();

  return <MergeInButton isDisabled={isDisabled} />;
}

export function DataCardLinkGraphButton () {
  const { isDisabled } = useCardAction();

  return <LinkGraphButton isDisabled={isDisabled} />;
}
