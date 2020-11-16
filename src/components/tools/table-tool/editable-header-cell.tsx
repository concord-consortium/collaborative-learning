import React, { useState } from "react";
import { TColumn, THeaderRendererProps } from "./grid-types";

import "./editable-header-cell.scss";

interface IProps extends THeaderRendererProps {
}
export const EditableHeaderCell: React.FC<IProps> = ({ column: _column }) => {
  const column = _column as unknown as TColumn;
  const { name, appData } = column;
  const {
    editableName, isEditing, onBeginHeaderCellEdit, onHeaderCellEditKeyDown, onEndHeaderCellEdit
  } = appData || {};
  const [nameValue, setNameValue] = useState(editableName ? name as string : "");
  const handleClick = () => {
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
    <div className={"editable-header-cell"} onClick={handleClick}>
      {isEditing
        ? <HeaderCellInput style={style} value={nameValue}
            onKeyDown={handleKeyDown} onChange={handleChange} onClose={handleClose} />
        : name}
    </div>
  );
};

function autoFocusAndSelect(input: HTMLInputElement | null) {
  input?.focus();
  input?.select();
}

interface IHeaderCellInputProps {
  style?: React.CSSProperties;
  value: string;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onChange: (value: string) => void;
  onClose: (accept: boolean) => void;
}
const HeaderCellInput: React.FC<IHeaderCellInputProps> = ({ style, value, onKeyDown, onChange, onClose }) => {
  return (
    <div className="rdg-editor-container clue-editor-container" style={style}>
      <input
        className="rdg-text-editor"
        ref={autoFocusAndSelect}
        value={value}
        onKeyDown={onKeyDown}
        onChange={event => onChange(event.target.value)}
        onBlur={() => onClose(true)}
      />
    </div>
  );
};
