import classNames from "classnames";
import { observer } from "mobx-react";
import React, { useContext, useState } from "react";
import { TileModelContext } from "../tiles/tile-api";
import { TileLabelInput } from "./tile-label-input";

import "./editable-tile-title.scss";
// TODO: previously these CSS rules were in `editable-tile-title.scss` even though those classes
// aren't used by this component. Clients that make use of these classes should be revised to
// use the recently-introduced `<TileTitleArea/>` component or include the corresponding styles
// directly rather than relying on their inclusion by this component.
import "./tile-title-area.scss";

interface IProps {
  className?: string;
  readOnly?: boolean;
  measureText: (text: string) => number;
  onBeginEdit?: () => void;
  onEndEdit?: (title?: string) => void;
}
export const EditableTileTitle: React.FC<IProps> = observer(({
  className, readOnly, measureText, onBeginEdit, onEndEdit
}) => {

  // console.log("📁 editable-tile-title.tsx ------------------------");
  // console.log("\t🥩 className:", className);
  // console.log("\t🥩 onEndEdit:", onEndEdit);
  // console.log("\t🥩 onBeginEdit:", onBeginEdit);
  // console.log("\t🥩 measureText:", measureText);
  // console.log("\t🥩 readOnly:", readOnly);


  // model and observer() allow this component to re-render
  // when the title changes without re-rendering the entire tile
  const model = useContext(TileModelContext);
  const title = model?.computedTitle || "Tile Title";
  const kTitlePadding = 30;
  const width = Math.ceil(measureText(title)) + kTitlePadding;
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
    // console.log("📁 editable-tile-title.tsx ------------------------");
    // console.log("\t🏭 handleKeyDown");
    const { key } = e;
    // console.log("\t🥩 key:", key);

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
    // This automatically logs the change
    trimTitle && model?.setTitle(trimTitle);
    onEndEdit?.(accept && trimTitle ? trimTitle : undefined);
    setIsEditing(false);
  };
  const isDefaultTitle = title && /Graph\s+(\d+)\s*$/.test(title);
  const classes = classNames("editable-tile-title", className,
                            { "editable-tile-title-editing": isEditing,
                            "editable-tile-title-default": isDefaultTitle });
  const containerStyle: React.CSSProperties = { width };
  console.log("\t🔪 containerStyle:", containerStyle);

  const kMinInputWidth = 200; // so there's room to expand very short titles
  const inputWidth = width >= kMinInputWidth ? "100%" : kMinInputWidth;
  const inputStyle: React.CSSProperties = { width: inputWidth };
  return (
    <div className={classes} style={containerStyle} onClick={handleClick}>
      {isEditing
        ? <TileLabelInput value={editingTitle} style={inputStyle}
            onKeyDown={handleKeyDown} onChange={setEditingTitle} onBlur={() => handleClose(true)} />
        : <div className="editable-tile-title-text">{title}</div>}
    </div>
  );
});
