import classNames from "classnames";
import { observer } from "mobx-react";
import React, { useState } from "react";
import { HeaderCellInput } from "./header-cell-input";

import "./editable-header-cell.scss";

interface IProps {
  className?: string;
  readOnly?: boolean;
  getTitle: () => string | undefined;
  getTitleWidth: () => number | undefined;
  onBeginEdit?: () => void;
  onEndEdit?: (title?: string) => void;
}
export const EditableTableTitle: React.FC<IProps> = observer(({
  className, readOnly, getTitle, getTitleWidth, onBeginEdit, onEndEdit
}) => {
  // getTitle() and observer() allow this component to re-render
  // when the title changes without re-rendering the entire TableTool
  const title = getTitle();
  const [isEditing, setIsEditing] = useState(false);
  const [editingTitle, setEditingTitle] = useState(title);
  const handleClick = () => {
    if (!readOnly && !isEditing) {
      onBeginEdit?.();
      setEditingTitle(title);
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
  const handleClose = (accept: boolean) => {
    const trimTitle = editingTitle?.trim();
    onEndEdit?.(accept && trimTitle ? trimTitle : undefined);
    setIsEditing(false);
  };
  const isDefaultTitle = title && /Table\s+(\d+)\s*$/.test(title);
  const classes = classNames("editable-header-cell", className,
                            { "table-title-editing": isEditing, "table-title-default": isDefaultTitle });
  const style = { width: getTitleWidth() };
  return (
    <div className={classes} style={style} onClick={handleClick}>
      {isEditing
        ? <HeaderCellInput style={style} value={editingTitle}
            onKeyDown={handleKeyDown} onChange={setEditingTitle} onClose={handleClose} />
        : title}
    </div>
  );
});
