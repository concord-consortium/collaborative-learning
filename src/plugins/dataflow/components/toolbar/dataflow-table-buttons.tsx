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
import { DataflowContentModelType } from "../../model/dataflow-content";
import { recordCase } from "../../model/utilities/recording-utilities";

import ViewBadgeIcon from "../../../../assets/icons/view/view-badge.svg";

/**
 * Points the program at a table, creating one only when it has none, and sets the columns up when
 * that table is empty. Shared by both buttons: the sample button has to make a table for the same
 * reasons Table It does.
 *
 * Re-preparing a table that already holds rows would wipe what the student captured, so the column
 * setup is gated on an empty one.
 */
function ensureLinkedTable(
  content: DataflowContentModelType,
  tile: any,
  addTilesContext: any,
  selectTile: (tileId: string) => void
) {
  const existingTableId = content.linkedTableTileId;
  if (existingTableId) {
    selectTile(existingTableId);
  } else {
    const sharedModel = content.sharedModel;
    if (!sharedModel) return;
    addTilesContext.addTileAfter("Table", tile, [sharedModel]);
  }
  if (content.dataSet.cases.length === 0) {
    content.prepareCapture();
  }
}

function useTableButton() {
  const tile = useContext(TileModelContext);
  const addTilesContext = useContext(AddTilesContext);
  const ui = useUIStore();
  const readOnly = useReadOnlyContext();
  const content = tile?.content as DataflowContentModelType | undefined;

  const ensure = () => {
    if (!content || !tile || !addTilesContext) return false;
    ensureLinkedTable(content, tile, addTilesContext, id => ui.setSelectedTileId(id));
    return true;
  };
  return { content, readOnly, ensure };
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
  const { content, readOnly, ensure } = useTableButton();
  const Icon = getTileComponentInfo("Table")?.Icon;

  return (
    <TileToolbarButton
      name={name}
      title={getTileCreateActionName("Table")}
      onClick={ensure}
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
  const { content, readOnly, ensure } = useTableButton();

  function handleClick() {
    if (!ensure() || !content) return;
    recordCase(content);
  }

  return (
    <TileToolbarButton
      name={name}
      title="Record single sample"
      onClick={handleClick}
      disabled={!content || readOnly}
    >
      <RecordSampleGlyph />
    </TileToolbarButton>
  );
});

/** A single filled point, for "capture one". Inline rather than an imported asset, unlike every
 * other button here, because there is no designed icon yet -- replace it with one. */
function RecordSampleGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <circle cx="12" cy="12" r="5" fill="currentColor" />
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
