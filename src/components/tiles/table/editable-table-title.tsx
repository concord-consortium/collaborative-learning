import classNames from "classnames";
import { observer } from "mobx-react";
import React, { useState } from "react";
import { TableContentModelType } from "../../../models/tiles/table/table-content";
import { verifyAlive } from "../../../utilities/mst-utils";
import { HeaderCellInput } from "./header-cell-input";
import { LinkGeometryButton } from "./link-geometry-button";

interface IProps {
  content: TableContentModelType;
  className?: string;
  readOnly?: boolean;
  showLinkButton: boolean;
  isLinkEnabled?: boolean;
  titleCellWidth: number;
  titleCellHeight: number;
  getLinkIndex: () => number;
  onBeginEdit?: () => void;
  onEndEdit?: (title?: string) => void;
  onLinkGeometryClick?: () => void;
}
export const EditableTableTitle: React.FC<IProps> = observer(function EditableTableTitle({
  content, className, readOnly, showLinkButton, isLinkEnabled, titleCellWidth, titleCellHeight,
  getLinkIndex, onBeginEdit, onEndEdit, onLinkGeometryClick
}) {

  verifyAlive(content);

  // content.title and observer() allow this component to re-render
  // when the title changes without re-rendering the entire TableTool
  const title = content.title;
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
      {showLinkButton && !isEditing &&
        <LinkGeometryButton isEnabled={!readOnly && isLinkEnabled} getLinkIndex={getLinkIndex}
                            onClick={onLinkGeometryClick} />}
    </div>
  );
});
