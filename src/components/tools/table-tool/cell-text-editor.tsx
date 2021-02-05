import React, { useEffect } from "react";
import { EditorProps } from "react-data-grid";
import { TColumn } from "./table-types";

function autoFocusAndSelect(input: HTMLInputElement | null) {
  input?.focus();
  input?.select();
}

// patterned after TextEditor from "react-data-grid"
export default function CellTextEditor<TRow, TSummaryRow = unknown>({
  row, column, onRowChange, onClose
}: EditorProps<TRow, TSummaryRow>) {
  const _column: TColumn = column as unknown as TColumn;

  useEffect(() => {
    _column.appData?.onBeginBodyCellEdit?.();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    onClose(true);
    _column.appData?.onEndBodyCellEdit?.(e.target.value);
  };

  const raw = row[column.key as keyof TRow];
  const value = raw == null ? "" : raw;
  return (
    <input
      className="rdg-text-editor"
      ref={autoFocusAndSelect}
      value={value as unknown as string}
      onChange={event => onRowChange({ ...row, [column.key]: event.target.value })}
      onBlur={handleBlur}
    />
  );
}
