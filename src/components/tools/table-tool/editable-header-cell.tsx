import React, { useState } from "react";
import { kRowHeight, TColumn, THeaderRendererProps } from "./table-types";
import { HeaderCellInput } from "./header-cell-input";

interface IProps extends THeaderRendererProps {
}
export const EditableHeaderCell: React.FC<IProps> = ({ column: _column }) => {
  const column = _column as unknown as TColumn;
  const { name, appData } = column;
  const {
    gridContext, editableName, isEditing,
    onBeginHeaderCellEdit, onHeaderCellEditKeyDown, onEndHeaderCellEdit
  } = appData || {};
  const [nameValue, setNameValue] = useState(editableName ? name as string : "");
  const handleClick = () => {
    !isEditing && gridContext?.onSelectColumn(column.key);
  };
  const handleDoubleClick = () => {
    editableName && !isEditing && onBeginHeaderCellEdit?.();
  };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const { key } = e;
    switch (key) {
      case "Escape":
        handleClose(false);
        break;
      case "Enter":
      case "Tab":
        handleClose(true);
        onHeaderCellEditKeyDown?.(e);
        break;
    }
  };
  const handleChange = (value: string) => {
    setNameValue(value);
  };
  const handleClose = (accept: boolean) => {
    onEndHeaderCellEdit?.(accept ? nameValue : undefined);
  };
  const style: React.CSSProperties = { width: column.width };
  // ReactDataGrid's styling of the cell editor relies on an interesting interplay between the container
  // (.rdg-editor-container), which has `{ display: "contents" }` in its CSS, which according to MDN means:
  //
  // These elements don't produce a specific box by themselves.
  // They are replaced by their pseudo-box and their child boxes.
  //
  // Essentially, the container should figure out its own box from its children. But then the child <input>
  // element specifies `{ height: 100% }`, so the height of the parent is determined from the children at
  // the same time that the height of the child depends on the parent. Hmmm. In any case, this seems to
  // work just fine in most circumstances and in most browsers, but starting with 7.0.0-canary.44, the
  // height calculation no longer works for the column header cells in Chrome, although it continues to
  // work for the title cell and the table body cells in Chrome as well as in all three contexts in Firefox.
  // ¯\_(ツ)_/¯ The fix is to force the <input> to be the height of the row with an inline style.
  const inputStyle: React.CSSProperties = { height: kRowHeight };
  return (
    <div className={"editable-header-cell"} onClick={handleClick} onDoubleClick={handleDoubleClick}>
      {isEditing
        ? <HeaderCellInput style={style} inputStyle={inputStyle} value={nameValue}
            onKeyDown={handleKeyDown} onChange={handleChange} onClose={handleClose} />
        : name}
    </div>
  );
};
