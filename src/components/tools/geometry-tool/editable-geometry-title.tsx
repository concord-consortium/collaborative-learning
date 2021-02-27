import classNames from "classnames";
import { observer } from "mobx-react";
import React, { useState } from "react";
import { SizeMeProps } from "react-sizeme";
import { GeometryLabelInput } from "./geometry-label-input";

import "./geometry-title.scss";

interface IProps extends SizeMeProps {
  className?: string;
  readOnly?: boolean;
  scale?: number;
  getTitle: () => string | undefined;
  measureText: (text: string) => number;
  onBeginEdit?: () => void;
  onEndEdit?: (title?: string) => void;
}
export const EditableGeometryTitle: React.FC<IProps> = observer(({
  className, readOnly, size: contentSize, scale, getTitle, measureText, onBeginEdit, onEndEdit
}) => {
  // getTitle() and observer() allow this component to re-render
  // when the title changes without re-rendering the entire Geometry
  const title = getTitle() || "Graph";
  const kTitlePadding = 30;
  // There can be one render before we know our container size, which will then be
  // immediately replaced by a subsequent render with a known container size.
  // Place it roughly in the middle of the screen until we have a proper position.
  const kContainerlessPosition = 450;
  const width = Math.ceil(measureText(title)) + kTitlePadding;
  const left = contentSize.width ? (contentSize.width / (scale || 1) - width) / 2: kContainerlessPosition;
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
  const isDefaultTitle = title && /Graph\s+(\d+)\s*$/.test(title);
  const classes = classNames("geometry-title", className,
                            { "geometry-title-editing": isEditing, "geometry-title-default": isDefaultTitle });
  const containerStyle: React.CSSProperties = { left, width };
  const kMinInputWidth = 200; // so there's room to expand very short titles
  const inputWidth = width >= kMinInputWidth ? "100%" : kMinInputWidth;
  const inputStyle: React.CSSProperties = { width: inputWidth };
  return (
    <div className={classes} style={containerStyle} onClick={handleClick}>
      {isEditing
        ? <GeometryLabelInput value={editingTitle} style={inputStyle}
            onKeyDown={handleKeyDown} onChange={setEditingTitle} onBlur={() => handleClose(true)} />
        : <div className="geometry-title-text">{title}</div>}
    </div>
  );
});
