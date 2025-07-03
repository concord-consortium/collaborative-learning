import React, { useContext, useRef } from "react";
import { observer } from "mobx-react";

import { IToolbarButtonComponentProps, registerTileToolbarButtons } from "../../toolbar/toolbar-button-manager";
import { MergeInButton } from "../../toolbar/merge-in-button";
import { useConsumerTileLinking } from "../../../hooks/use-consumer-tile-linking";
import { getTileDataSet } from "../../../models/shared/shared-data-utils";
import { TileModelContext } from "../tile-api";
import { TableToolbarContext } from "./table-toolbar-context";
import { kGraphTileType } from "../../../plugins/graph/graph-defs";
import { TileToolbarButton } from "../../toolbar/tile-toolbar-button";
import { DataSetViewButton } from "../../toolbar/data-set-view-button";
import { SharedDataSet } from "../../../models/shared/shared-data-set";

import DeleteSelectedIcon from "../../../assets/icons/delete/delete-selection-icon.svg";
import SetExpressionIcon from "../../../clue/assets/icons/table/set-expression-icon.svg";
import ViewDataAsGraphIcon from "../../../assets/icons/view-data-as-graph-icon.svg";
import LinkGraphIcon from "../../../clue/assets/icons/table/link-graph-icon.svg";
import ImportDataIcon from "../../../clue/assets/icons/table/import-data-icon.svg";
const DeleteSelectedButton = ({name}: IToolbarButtonComponentProps) => {
  const toolbarContext = useContext(TableToolbarContext);

  return (
    <TileToolbarButton
      name={name}
      title="Clear cell"
      onClick={() => toolbarContext?.deleteSelected()}
    >
      <DeleteSelectedIcon />
    </TileToolbarButton>
  );
};


export const SetExpressionButton = ({name}: IToolbarButtonComponentProps) => {
  const toolbarContext = useContext(TableToolbarContext);

  return (
    <TileToolbarButton
      name={name}
      title="Set expression"
      onClick={() => toolbarContext?.showExpressionsDialog()}
    >
      <SetExpressionIcon />
    </TileToolbarButton>
  );
};

// TODO: this exact component can be used in the data-card toolbar
// The only difference currently is the tooltip text
export const LinkTableButton = observer(function LinkTableButton({name}: IToolbarButtonComponentProps) {

  // Assume we always have a model
  const model = useContext(TileModelContext)!;
  const dataSet = getTileDataSet(model.content);

  // Currently we only enable the link button if there are 2 or more attributes
  // this is because the linking is generally used for graph and geometry tiles
  // both of them in 2 attributes (in CLUE)
  const hasLinkableRows = dataSet ? dataSet.attributes.length > 1 : false;

  const { isLinkEnabled, showLinkTileDialog } =
    useConsumerTileLinking({ model, hasLinkableRows, shareType: SharedDataSet });

  const handleClick = (e: React.MouseEvent) => {
    isLinkEnabled && showLinkTileDialog();
    e.stopPropagation();
  };
  return (
    <TileToolbarButton
      name={name}
      title="Link table"
      onClick={handleClick}
      disabled={!isLinkEnabled}
    >
      <LinkGraphIcon />
    </TileToolbarButton>
  );
});

export const LinkGraphButton = observer(function LinkGraphButton({name}: IToolbarButtonComponentProps) {
  const model = useContext(TileModelContext)!;
  const dataSet = getTileDataSet(model.content);

  const hasLinkableRows = dataSet ? dataSet.attributes.length > 1 : false;

  const { isLinkEnabled, showLinkTileDialog }
  = useConsumerTileLinking({ model, hasLinkableRows, shareType: SharedDataSet, tileType: kGraphTileType });

  const handleClick = (e: React.MouseEvent) => {
    showLinkTileDialog && showLinkTileDialog();
    e.stopPropagation();
  };

  return (
    <TileToolbarButton
      name={name}
      title="Graph It!"
      onClick={handleClick}
      disabled={!isLinkEnabled}
    >
      <ViewDataAsGraphIcon />
    </TileToolbarButton>
 );

});

const TableMergeInButton = ({name}: IToolbarButtonComponentProps) => {
  return <MergeInButton name={name} title="Add data from..."/>;
};

export const ImportDataButton = ({name}: IToolbarButtonComponentProps) => {
  const toolbarContext = useContext(TableToolbarContext);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      toolbarContext?.importData(file);
    }
    event.target.value = "";
  };

  return (
    <>
      <TileToolbarButton
        name={name}
        title="Import data"
        onClick={handleButtonClick}
      >
        <ImportDataIcon />
      </TileToolbarButton>
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: "none" }}
        onChange={handleFileChange}
        accept=".csv" // or whatever formats you support
      />
      <span className="toolbar-separator" />
    </>
  );
};

registerTileToolbarButtons("table",
[
  {
    name: "delete",
    component: DeleteSelectedButton
  },
  {
    name: "set-expression",
    component: SetExpressionButton
  },
  {
    name: "link-tile",
    component: LinkTableButton
  },
  {
    name: "link-graph",
    component: LinkGraphButton
  },
  {
    name: "merge-in",
    component: TableMergeInButton
  },
  {
    // This button takes an argument saying what kind of tile it should create.
    name: "data-set-view",
    component: DataSetViewButton
  },
  {
    name: "import-data",
    component: ImportDataButton
  }
]);
