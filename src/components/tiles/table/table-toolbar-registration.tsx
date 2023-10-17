import React, { useContext } from "react";

import { registerTileToolbarButtons } from "../../toolbar/toolbar-button-manager";
import { MergeInButton } from "../../toolbar/merge-in-button";
import { useConsumerTileLinking } from "../../../hooks/use-consumer-tile-linking";
import { getTileDataSet } from "../../../models/shared/shared-data-utils";
import { TileModelContext } from "../tile-api";
import { TableToolbarContext } from "./table-toolbar-context";
import { kGraphTileType } from "../../../plugins/graph/graph-defs";
import { TileToolbarButton } from "../../toolbar/tile-toolbar-button";

import DeleteSelectedIconSvg from "../../../assets/icons/delete/delete-selection-icon.svg";
import SetExpressionIconSvg from "../../../clue/assets/icons/table/set-expression-icon.svg";
import ViewDataAsGraphIcon from "../../../assets/icons/view-data-as-graph-icon.svg";
import LinkGraphIcon from "../../../clue/assets/icons/table/link-graph-icon.svg";
import { DataSetViewButton } from "../../toolbar/data-set-view-button";

const DeleteSelectedButton = () => {
  const toolbarContext = useContext(TableToolbarContext);

  return (
    <TileToolbarButton
      onClick={() => toolbarContext?.deleteSelected()}
    >
      <DeleteSelectedIconSvg />
    </TileToolbarButton>
  );
};


export const SetExpressionButton = () => {
  const toolbarContext = useContext(TableToolbarContext);

  return (
    <TileToolbarButton
      onClick={() => toolbarContext?.showExpressionsDialog()}
    >
      <SetExpressionIconSvg />
    </TileToolbarButton>
  );
};

// TODO: this exact component can be used in the data-card toolbar
// The only difference currently is the tooltip text
function LinkTableButton() {

  // Assume we always have a model
  const model = useContext(TileModelContext)!;
  const dataSet = getTileDataSet(model.content);

  // Currently we only enable the link button if there are 2 or more attributes
  // this is because the linking is generally used for graph and geometry tiles
  // both of them in 2 attributes (in CLUE)
  const hasLinkableRows = dataSet ? dataSet.attributes.length > 1 : false;

  const { isLinkEnabled, showLinkTileDialog } =
    useConsumerTileLinking({ model, hasLinkableRows });

  const handleClick = (e: React.MouseEvent) => {
    isLinkEnabled && showLinkTileDialog();
    e.stopPropagation();
  };
  return (
    <TileToolbarButton
      onClick={handleClick}
      disabled={!isLinkEnabled}
    >
      <LinkGraphIcon />
    </TileToolbarButton>
  );
}

export const LinkGraphButton = () => {
  const model = useContext(TileModelContext)!;
  const dataSet = getTileDataSet(model.content);

  const hasLinkableRows = dataSet ? dataSet.attributes.length > 1 : false;

  const { isLinkEnabled, showLinkTileDialog }
  = useConsumerTileLinking({ model, hasLinkableRows, onlyType: kGraphTileType });

  const handleClick = (e: React.MouseEvent) => {
    showLinkTileDialog && showLinkTileDialog();
    e.stopPropagation();
  };

  return (
    <TileToolbarButton
      onClick={handleClick}
      disabled={!isLinkEnabled}
    >
      <ViewDataAsGraphIcon />
    </TileToolbarButton>
 );

};

const TableMergeInButton = () => {
  return <MergeInButton/>;
};

registerTileToolbarButtons("table",
[
  {
    name: "delete",
    title: "Clear cell",
    component: DeleteSelectedButton
    // Kbd shortcut?
  },
  {
    name: "set-expression",
    title: "Set expression",
    component: SetExpressionButton
  },
  {
    name: "link-tile",
    title: "Link table",
    component: LinkTableButton
  },
  {
    name: "link-graph",
    title: "View data as graph",
    component: LinkGraphButton
  },
  {
    name: "merge-in",
    title: "Add data from...",
    component: TableMergeInButton
  },
  {
    // This button takes an argument saying what kind of tile it should create.
    name: "data-set-view",
    title: "Create a linked {1} tile",
    component: DataSetViewButton
  }
]);
