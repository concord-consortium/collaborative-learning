import React, { useContext } from "react";
import { observer } from "mobx-react";

import { AddTilesContext, TileModelContext } from "../../../../components/tiles/tile-api";
import { useReadOnlyContext } from "../../../../components/document/read-only-context";
import { BadgedIcon } from "../../../../components/toolbar/badged-icon";
import { TileToolbarButton } from "../../../../components/toolbar/tile-toolbar-button";
import { IToolbarButtonComponentProps } from "../../../../components/toolbar/toolbar-button-manager";
import { useUIStore } from "../../../../hooks/use-stores";
import { getTileComponentInfo } from "../../../../models/tiles/tile-component-info";
import { getTileCreateActionName } from "../../../../models/tiles/tile-content-info";
import { DataflowContentModelType, kDataflowTableTileType } from "../../model/dataflow-content";

import ViewBadgeIcon from "../../../../assets/icons/view/view-badge.svg";
import RecordSampleIcon from "../../assets/icons/record-sample-icon.svg";

function useTableButton() {
  const tile = useContext(TileModelContext);
  const addTilesContext = useContext(AddTilesContext);
  const ui = useUIStore();
  const readOnly = useReadOnlyContext();
  const content = tile?.content as DataflowContentModelType | undefined;

  /** Adds a table linked to the program's dataset. The content calls it from inside its own
   * action, so the table joins that action's history entry. */
  const addTable = () => {
    const sharedModel = content?.sharedModel;
    if (!tile || !addTilesContext || !sharedModel) return;
    addTilesContext.addTileAfter(kDataflowTableTileType, tile, [sharedModel]);
  };

  /** Reveals the program's table. Table It does this; Record Single Sample must NOT: a tile toolbar
   * renders only for the selected tile (tile-toolbar.tsx), so selecting the table takes the sample
   * button off screen and a second sample becomes unclickable. */
  const selectTable = () => {
    const tableId = content?.linkedTableTileId;
    if (tableId) ui.setSelectedTileId(tableId);
  };
  return { content, readOnly, addTable, selectTable };
}

/**
 * Dataflow's Table It, registered as "table-it" rather than overriding `data-set-view`: Graph It
 * uses that name too, and overriding it made one component serve both, which cost Graph It its
 * icon. Unlike the shared button this reuses an already-linked table rather than adding a second,
 * which is what keeps a capture tied to the one program it describes.
 */
export const DataflowTableButton = observer(function DataflowTableButton(
  { name }: IToolbarButtonComponentProps
) {
  const { content, readOnly, addTable, selectTable } = useTableButton();
  const Icon = getTileComponentInfo(kDataflowTableTileType)?.Icon;

  function handleClick() {
    if (!content) return;
    const hadTable = !!content.linkedTableTileId;
    content.showCaptureInTable(addTable);
    // An existing table may be anywhere in the document, so reveal it. A new one is added right
    // after this tile.
    if (hadTable) selectTable();
  }

  return (
    <TileToolbarButton
      name={name}
      title={getTileCreateActionName(kDataflowTableTileType)}
      onClick={handleClick}
      disabled={!content || readOnly}
    >
      {Icon ? <BadgedIcon Icon={Icon} Badge={ViewBadgeIcon} /> : "??"}
    </TileToolbarButton>
  );
});

/** Appends the program's current values to the table as the next point. */
export const RecordSingleSampleButton = observer(function RecordSingleSampleButton(
  { name }: IToolbarButtonComponentProps
) {
  const { content, readOnly, addTable } = useTableButton();

  function handleClick() {
    content?.recordSingleSample(addTable);
  }

  return (
    <TileToolbarButton
      name={name}
      title="Record single sample"
      onClick={handleClick}
      disabled={!content || readOnly}
    >
      <RecordSampleIcon />
    </TileToolbarButton>
  );
});
