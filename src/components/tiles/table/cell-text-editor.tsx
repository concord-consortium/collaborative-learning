import classNames from "classnames";
import React, { useEffect, useRef, useState, KeyboardEvent, useContext } from "react";
import { RenderEditCellProps } from "react-data-grid";
import TextareaAutosize from "react-textarea-autosize";
import { TColumn } from "./table-types";
import { TableContext } from "../hooks/table-context";
import { imagePasteHandler } from "../../../utilities/image-ingest";

// patterned after TextEditor from "react-data-grid"
// extended to call our onBeginBodyCellEdit()/onEndBodyCellEdit() functions
export default function CellTextEditor<TRow, TSummaryRow = unknown>({
  row, column, onRowChange, onClose
}: RenderEditCellProps<TRow, TSummaryRow>) {
  const _column: TColumn = column as unknown as TColumn;
  const origValueRef = useRef(row[column.key as keyof TRow] as unknown as string);
  const valueRef = useRef(origValueRef.current);
  const [value, setValue] = useState(origValueRef.current);
  const isEditingRef = useRef(true);
  const tableContext = useContext(TableContext);
  const linked = tableContext?.linked;

  const updateValue = (val: string) => {
    if (val !== valueRef.current) {
      valueRef.current = val;
      setValue(val);
      onRowChange({ ...row, [column.key]: val }, false);
    }
  };

  const saveChange = (newValue: string) => {
    onClose(true);
    _column.appData?.onEndBodyCellEdit?.(newValue);
  };

  const finishAndSave = (commitChanges: boolean) => {
    if (commitChanges) {
      saveChange(valueRef.current);
    } else {
      onClose(false);
    }
  };

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    // Ignore newline inserted when editor first opens via Enter/Return key.
    if (event.target.value === "\n") {
      // Select existing text in the editor.
      setTimeout(() => {
        event.target.select();
      }, 1);
      return;
    }

    updateValue(event.target.value);
  };

  const handlePaste = imagePasteHandler(contentUrl => {
    // Ingesting is async, so this can resolve after the user has moved on. Acting then would
    // commit into -- and close -- whatever cell is selected now, discarding its edit.
    if (!isEditingRef.current) return;

    valueRef.current = contentUrl;
    setValue(contentUrl);
    // Committed in one call rather than updateValue() + finishAndSave(). rdg's onClose(commit)
    // delegates to onRowChange with the row *it* currently holds, and no render happens between
    // the two within a single tick, so the pasted value would be dropped.
    onRowChange({ ...row, [column.key]: contentUrl }, true);
    _column.appData?.onEndBodyCellEdit?.(contentUrl);
  });

  useEffect(() => {
    _column.appData?.onBeginBodyCellEdit?.();
    return () => {
      isEditingRef.current = false;
      finishAndSave(false);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="rdg-editor-container">
      <TextareaAutosize
        value={value}
        className={classNames("rdg-text-editor", { linked })}
        style={{
          background: "white",
          display: "block",
          width: column.width
        }}
        autoFocus={true}
        onChange={handleChange}
        onPaste={handlePaste}
        onFocus={event => {
          event.target.select();
        }}
        onBlur={event => {
          finishAndSave(true);
        }}
        onKeyDown={(event: KeyboardEvent) => {
          const { key } = event;
          switch (key) {
            case 'Escape':
              finishAndSave(false);
              break;
            case 'Enter':
              finishAndSave(true);
              break;
          }
        }}
      />
    </div>
  );
}
