import React, { useContext } from "react";
import { Tooltip, TooltipProps } from "react-tippy";
import classNames from "classnames";
import DeleteSelectedIconSvg from "../../../assets/icons/delete/delete-selection-icon.svg";
import SetExpressionIconSvg from "../../../clue/assets/icons/table/set-expression-icon.svg";
import ViewDataAsGraphIcon from "../../../assets/icons/view-data-as-graph-icon.svg";
import LinkGraphIcon from "../../../clue/assets/icons/table/link-graph-icon.svg";
import { MergeInButton } from "../../../components/shared/merge-in-button";
import { useTooltipOptions } from "../../../hooks/use-tooltip-options";
import { useConsumerTileLinking } from "../../../hooks/use-consumer-tile-linking";
import { getTileDataSet } from "../../../models/shared/shared-data-utils";
import { TileModelContext } from "../tile-api";
import { TableToolbarContext } from "./table-toolbar-context";
import { kGraphTileType } from "../../../plugins/graph/graph-defs";

import "./table-toolbar.scss";

interface ITableButtonProps {
  className?: string;
  icon: any;
  onClick: (e: React.MouseEvent) => void;
  tooltipOptions: TooltipProps;
}
const TableButton = ({ className, icon, onClick, tooltipOptions}: ITableButtonProps) => {
  const to = useTooltipOptions(tooltipOptions);
  const classes = classNames("toolbar-button", className);
  return (
    <Tooltip {...to}>
      <button className={classes} onClick={onClick}>
        {icon}
      </button>
    </Tooltip>
  );
};

export const DeleteSelectedButton = () => {
  const toolbarContext = useContext(TableToolbarContext);

  return (
    <TableButton
      className="delete"
      icon={<DeleteSelectedIconSvg />}
      onClick={() => toolbarContext?.deleteSelected()}
      tooltipOptions={{ title: "Clear cell" }}
    />
  );
};

export const SetExpressionButton = () => {
  const toolbarContext = useContext(TableToolbarContext);

  return (
    <TableButton
      className="set-expression"
      icon={<SetExpressionIconSvg />}
      onClick={() => toolbarContext?.showExpressionsDialog()}
      tooltipOptions={{ title: "Set expression" }}
    />
  );
};

// TODO: this exact component can be used in the data-card toolbar
// The only difference currently is the tooltip text
export const LinkTileButton = () => {
  // Assume we always have a model
  const model = useContext(TileModelContext)!;
  const dataSet = getTileDataSet(model.content);
  // Currently we only enable the link button if there are 2 or more attributes
  // this is because the linking is generally used for graph and geometry tiles
  // both of them in 2 attributes (in CLUE)
  const hasLinkableRows = dataSet ? dataSet.attributes.length > 1 : false;
  const { isLinkEnabled, showLinkTileDialog } =
    useConsumerTileLinking({ model, hasLinkableRows });
  const classes = classNames("link-tile-button", { disabled: !isLinkEnabled });

  const handleClick = (e: React.MouseEvent) => {
    isLinkEnabled && showLinkTileDialog();
    e.stopPropagation();
  };

  return (
    <TableButton
      className={classes}
      icon={<LinkGraphIcon />}
      onClick={handleClick}
      tooltipOptions={{ title: "Link table" }}
    />
  );
};

export const LinkGraphButton = () => {
  // Assume we always have a model
  const model = useContext(TileModelContext)!;
  const dataSet = getTileDataSet(model.content);
  const hasLinkableRows = dataSet ? dataSet.attributes.length > 1 : false;
  const { showLinkTileDialog } = useConsumerTileLinking({ model, hasLinkableRows, onlyType: kGraphTileType });
  const classes = classNames("link-graph-button", {});

  const handleClick = (e: React.MouseEvent) => {
    showLinkTileDialog && showLinkTileDialog();
    e.stopPropagation();
  };

  return (
   <TableButton
     className={classes}
     icon={<ViewDataAsGraphIcon />}
     onClick={handleClick}
     tooltipOptions={{ title: "View Data as Graph" }}
   />
 );
};

export const TableMergeInButton = () => {
  return <MergeInButton />;
};
