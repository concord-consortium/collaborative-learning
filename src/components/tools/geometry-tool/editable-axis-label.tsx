import classNames from "classnames";
import { observer } from "mobx-react";
import React, { useState } from "react";
import { SizeMeProps } from "react-sizeme";
import { GeometryLabelInput } from "./geometry-label-input";

import "./editable-axis-label.scss";

interface IProps extends SizeMeProps {
  className?: string;
  readOnly?: boolean;
  scale?: number;
  // getTitle: () => string | undefined;
  getAxisName: string | undefined;
  measureText: (text: string) => number;
  onBeginEdit?: () => void;
  onEndEdit?: (axis?: string, label?: string) => void;
}
export const EditableGeometryAxisLabel: React.FC<IProps> = observer(({
  className, readOnly, size: contentSize, scale, getAxisName, measureText, onBeginEdit, onEndEdit
}) => {
  // getTitle() and observer() allow this component to re-render
  // when the title changes without re-rendering the entire Geometry
  const axisLabelX = getAxisName || "Axis";
  const kTitlePadding = 30;
  // There can be one render before we know our container size, which will then be
  // immediately replaced by a subsequent render with a known container size.
  // Place it roughly in the middle of the screen until we have a proper position.
  const kContainerlessPosition = 450;
  const width = Math.ceil(measureText(axisLabelX)) + kTitlePadding;
  const left = contentSize.width ? (contentSize.width / (scale || 1) - width) / 2: kContainerlessPosition;
  const [isEditing, setIsEditing] = useState(false);
  // const [editingTitle, setEditingTitle] = useState(title);
  const [editingAxisLabelX, setEditingAxisLabelX] = useState(axisLabelX);
  const handleClick = () => {
    if (!readOnly && !isEditing) {
      onBeginEdit?.();
      setEditingAxisLabelX(axisLabelX);
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
    const trimAxisLabel = editingAxisLabelX?.trim();
    onEndEdit?.(accept && trimAxisLabel ? trimAxisLabel : undefined);
    setIsEditing(false);
  };
  const isDefaultTitle = axisLabelX && /Graph\s+(\d+)\s*$/.test(axisLabelX);
  const classes = classNames("geometry-axis-label", className,
                            { "geometry-title-editing": isEditing, "geometry-axis-label-default": isDefaultTitle });
  const containerStyle: React.CSSProperties = { left, width };
  const kMinInputWidth = 200; // so there's room to expand very short titles
  const inputWidth = width >= kMinInputWidth ? "100%" : kMinInputWidth;
  const inputStyle: React.CSSProperties = { width: inputWidth };
  return (
    <div className={classes} style={containerStyle} onClick={handleClick}>
      {isEditing
        ? <GeometryLabelInput value={editingAxisLabelX} style={inputStyle}
            onKeyDown={handleKeyDown} onChange={setEditingAxisLabelX} onBlur={() => handleClose(true)} />
        : <div className="geometry-axis-label-text">{axisLabelX}</div>}
    </div>
  );
});
