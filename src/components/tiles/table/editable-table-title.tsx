import classNames from "classnames";
import { observer } from "mobx-react";
import React, { useState } from "react";
import { ITileModel } from "../../../models/tiles/tile-model";
import { verifyAlive } from "../../../utilities/mst-utils";
import { HeaderCellInput } from "./header-cell-input";

interface IProps {
  model: ITileModel;
  className?: string;
  readOnly?: boolean;
  titleCellWidth: number;
  titleCellHeight: number;
  onBeginEdit?: () => void;
  onEndEdit?: (title?: string) => void;
}
export const EditableTableTitle: React.FC<IProps> = observer(function EditableTableTitle({
  model, className, readOnly, titleCellWidth, titleCellHeight,
  onBeginEdit, onEndEdit
}) {

  verifyAlive(model, "EditableTableTile");

  // model.title and observer() allow this component to re-render
  // when the title changes without re-rendering the entire TableTool
  const title = model.title;
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
  const style = { width: titleCellWidth, height: titleCellHeight };
  return (
    <div className={classes} style={style} onClick={handleClick}>
      {isEditing
        ? <HeaderCellInput style={style} value={editingTitle || ""}
            onKeyDown={handleKeyDown} onChange={setEditingTitle} onClose={handleClose} />
        : title}
    </div>
  );
});
