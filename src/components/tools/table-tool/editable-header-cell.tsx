import React, { useState } from "react";
import { TColumn, THeaderRendererProps } from "./table-types";
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
  const style = { width: column.width };
  return (
    <div className={"editable-header-cell"} onClick={handleClick} onDoubleClick={handleDoubleClick}>
      {isEditing
        ? <HeaderCellInput style={style} value={nameValue}
            onKeyDown={handleKeyDown} onChange={handleChange} onClose={handleClose} />
        : name}
    </div>
  );
};
