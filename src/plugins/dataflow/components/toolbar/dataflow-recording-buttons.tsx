import React, { useContext } from "react";
import { observer } from "mobx-react";

import { TileModelContext } from "../../../../components/tiles/tile-api";
import { useReadOnlyContext } from "../../../../components/document/read-only-context";
import { TileToolbarButton } from "../../../../components/toolbar/tile-toolbar-button";
import { IToolbarButtonComponentProps } from "../../../../components/toolbar/toolbar-button-manager";
import { DataflowContentModelType } from "../../model/dataflow-content";

import RecordIcon from "../../assets/topbar-buttons/record-icon.svg";
import StopIcon from "../../assets/topbar-buttons/stop-icon.svg";
import ClearIcon from "../../assets/topbar-buttons/clear-icon.svg";

function useRecordingContent() {
  const tile = useContext(TileModelContext);
  const readOnly = useReadOnlyContext();
  return { content: tile?.content as DataflowContentModelType | undefined, readOnly };
}

/** Starts a run, appending to whatever the table already holds. */
export const RecordButton = observer(function RecordButton({ name }: IToolbarButtonComponentProps) {
  const { content, readOnly } = useRecordingContent();
  return (
    <TileToolbarButton
      name={name}
      title="Record data"
      onClick={() => content?.startRecording()}
      disabled={!content || readOnly || content.isRecording}
    >
      <RecordIcon />
    </TileToolbarButton>
  );
});

/** The only live control during a run -- see ToolbarBusyContext in dataflow-tile.tsx. */
export const StopButton = observer(function StopButton({ name }: IToolbarButtonComponentProps) {
  const { content, readOnly } = useRecordingContent();
  const recording = !!content?.isRecording;
  return (
    <TileToolbarButton
      name={name}
      title="Stop recording"
      onClick={() => content?.stopRecording()}
      highlighted={recording}
      disabled={!content || readOnly || !recording}
      disabledMessage="Start a recording to enable this action"
    >
      <StopIcon />
    </TileToolbarButton>
  );
});

/**
 * Parts the program from its recording. Calls detachLinkedTables directly rather than through a
 * wrapper action: that method calls withoutUndo(), which MST ignores (with a warning) when it runs
 * inside a child action, and putting the detach back on the undo stack reintroduces the "Not a
 * child" crash CLUE-740 documented.
 *
 * Non-destructive, so no confirmation: the linked table keeps the student's points and the program
 * gets a fresh dataset. Where nothing is following, detachLinkedTables empties the dataset instead.
 */
export const ClearButton = observer(function ClearButton({ name }: IToolbarButtonComponentProps) {
  const { content, readOnly } = useRecordingContent();
  const hasData = !!content && content.dataSet.cases.length > 0;
  return (
    <TileToolbarButton
      name={name}
      title="Clear recording"
      onClick={() => content?.detachLinkedTables()}
      disabled={!content || readOnly || content.isRecording || !hasData}
      disabledMessage="Record some data to enable this action"
    >
      <ClearIcon />
    </TileToolbarButton>
  );
});
