import React, { useEffect } from "react";
import { EditorProps } from "react-data-grid";
import { TColumn } from "./table-types";

// Starting with ReactDataGrid 7.0.0-canary.35, RDG started using Linaria CSS-in-JS for its internal
// styling. As with CSS Modules and other CSS-in-JS solutions, this involves dynamically generating
// class names on the fly. Separately, the `CellTextEditor` class below is a modified version of
// RDG's internal `TextEditor` class which extends its functionality in ways that aren't relevant
// to this discussion. The important point is that we would like whatever styling is applied to
// the internal `TextEditor` class to be applied to our `CellTextEditor` variant. Furthermore, in
// addition to using the `CellTextEditor` class in the body of the table, as RDG does with its
// TextEditor component internally, we also use it for editing column header cells and the table
// title with the intent that the styling should be consistent across all of these instances.
// Unfortunately, with the switch to Linaria, instead of tying their internal CSS to the public
// class names RDG ties its internal CSS to the dynamically generated class names. Therefore,
// to preserve the prior behavior we must give our instances of these components the same
// classes as the components they're replacing, including the dynamically generated classes.
// This degree of coupling is clearly not ideal, but the alternative would be to copy the CSS
// from RDG and maintain a redundant copy of it which is potentially an even more challenging
// synchronization task. At least this way, we can (theoretically) add a unit test to validate
// that the correct CSS was applied and potentially even automate the process of extracting
// the dynamically generated class names. It turns out that the first part of each class name
// is stable for a given component and the last part of the class name is just a coded instance
// of the version number. Therefore, we stick with this approach for now. Down the road we may
// be able to submit a PR which would obviate the need for some of our overrides.
export const RDG_INTERNAL_EDITOR_CONTAINER_CLASS = "e1d24x2700-canary46";
export const RDG_INTERNAL_TEXT_EDITOR_CLASS = "t16y9g8l700-canary46";

function autoFocusAndSelect(input: HTMLInputElement | null) {
  input?.focus();
  input?.select();
}

// patterned after TextEditor from "react-data-grid"
// extended to call our onBeginBodyCellEdit()/onEndBodyCellEdit() functions
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
      className={`rdg-text-editor ${RDG_INTERNAL_TEXT_EDITOR_CLASS}`}
      ref={autoFocusAndSelect}
      value={value as unknown as string}
      onChange={event => onRowChange({ ...row, [column.key]: event.target.value })}
      onBlur={handleBlur}
    />
  );
}
