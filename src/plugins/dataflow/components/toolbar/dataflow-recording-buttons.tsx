import React from "react";
import { observer } from "mobx-react";

import { useReadOnlyContext } from "../../../../components/document/read-only-context";
import { TileToolbarButton } from "../../../../components/toolbar/tile-toolbar-button";
import { IToolbarButtonComponentProps } from "../../../../components/toolbar/toolbar-button-manager";
import { useDataflowContent } from "../../hooks/use-dataflow-content";
import { useLinkedTable } from "./dataflow-table-buttons";

import RecordIcon from "../../assets/icons/record-icon.svg";
import StopIcon from "../../assets/icons/stop-icon.svg";
import ClearIcon from "../../assets/icons/clear-icon.svg";

/** Shared with dataflow-tile's busy-toolbar exemption. */
export const kStopButtonName = "stop";

/**
 * Starts a run, appending to whatever the table already holds.
 *
 * Makes a table first when the program has none, for the same reason Record Single Sample does: a
 * recording whose points land nowhere visible looks like a program that is doing nothing. Does not
 * select that table -- a tile toolbar renders only for the selected tile, so selecting it would
 * take Stop off screen mid-run.
 */
export const RecordButton = observer(function RecordButton({ name }: IToolbarButtonComponentProps) {
  const { content, readOnly, addTable } = useLinkedTable();

  function handleClick() {
    content.showCaptureInTable(addTable);
    content.startRecording();
  }

  return (
    <TileToolbarButton
      name={name}
      title="Record data"
      onClick={handleClick}
      disabled={readOnly || content.isRecording}
      disabledMessage="Stop the current recording to start another"
    >
      <RecordIcon />
    </TileToolbarButton>
  );
});

/** The only live control during a run -- see ToolbarBusyContext in dataflow-tile.tsx. */
export const StopButton = observer(function StopButton({ name }: IToolbarButtonComponentProps) {
  const content = useDataflowContent();
  const readOnly = useReadOnlyContext();
  const recording = content.isRecording;
  return (
    <TileToolbarButton
      name={name}
      title="Stop recording"
      onClick={() => content.stopRecording()}
      highlighted={recording}
      disabled={readOnly || !recording}
      disabledMessage="Start a recording to enable this action"
    >
      <StopIcon />
    </TileToolbarButton>
  );
});

/**
 * Empties the recording in place, leaving the table linked and showing the capture's columns
 * (see clearRecording).
 *
 * No confirmation: "clear" is a word students understand, a recording is cheap to redo, and unlike
 * the structural-change detach this stays on the undo stack.
 */
export const ClearButton = observer(function ClearButton({ name }: IToolbarButtonComponentProps) {
  const content = useDataflowContent();
  const readOnly = useReadOnlyContext();
  const hasData = content.dataSet.cases.length > 0;
  return (
    <TileToolbarButton
      name={name}
      title="Clear recording"
      onClick={() => content.clearRecording()}
      disabled={readOnly || content.isRecording || !hasData}
      disabledMessage="Record some data to enable this action"
    >
      <ClearIcon />
    </TileToolbarButton>
  );
});
