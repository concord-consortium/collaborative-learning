import classNames from "classnames";
import React, { useState } from "react";
import { HeaderCellInput } from "./header-cell-input";

import "./editable-header-cell.scss";

interface IProps {
  className?: string;
  readOnly?: boolean;
  titleWidth?: number;
  title: string;
  setTitle: (title: string) => void;
  onBeginEdit?: () => void;
  onEndEdit?: (title?: string) => void;
}
export const EditableTableTitle: React.FC<IProps> = ({
  className, readOnly, titleWidth, title, setTitle, onBeginEdit, onEndEdit
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const handleClick = () => {
    if (!readOnly && !isEditing) {
      onBeginEdit?.();
      setIsEditing(true);
    }
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
        break;
    }
  };
  const handleChange = (value: string) => {
    setTitle(value);
  };
  const handleClose = (accept: boolean) => {
    onEndEdit?.(accept && title ? title : undefined);
    setIsEditing(false);
  };
  const classes = classNames("editable-header-cell", className, { "table-title-editing": isEditing });
  const style = { width: titleWidth };
  return (
    <div className={classes} style={style} onClick={handleClick}>
      {isEditing
        ? <HeaderCellInput style={style} value={title}
            onKeyDown={handleKeyDown} onChange={handleChange} onClose={handleClose} />
        : title}
    </div>
  );
};
