import classNames from "classnames";
import { observer } from "mobx-react";
import React, { useContext, useRef, useState } from "react";
import { useReadOnlyContext } from "../document/read-only-context";
import { TileModelContext } from "../tiles/tile-api";
import { TileLabelInput } from "./tile-label-input";

/** Callback to programmatically set title text and cursor position. */
export type TitleTextInserter = (text: string, cursorPos: number) => void;

import "./editable-tile-title.scss";
// TODO: previously these CSS rules were in `editable-tile-title.scss` even though those classes
// aren't used by this component. Clients that make use of these classes should be revised to
// use the recently-introduced `<TileTitleArea/>` component or include the corresponding styles
// directly rather than relying on their inclusion by this component.
import "./tile-title-area.scss";

interface IProps {
  className?: string;
  measureText: (text: string) => number;
  onBeginEdit?: () => void;
  onEndEdit?: (title?: string) => void;
  onBeforeClose?: () => void;
  onRegisterTextInserter?: (inserter: TitleTextInserter | null) => void;
}
export const EditableTileTitle: React.FC<IProps> = observer(({
  className, measureText, onBeginEdit, onEndEdit, onBeforeClose, onRegisterTextInserter
}) => {
  const readOnly = useReadOnlyContext();
  // model and observer() allow this component to re-render
  // when the title changes without re-rendering the entire tile
  const model = useContext(TileModelContext);
  const title = model?.computedTitle || "Tile Title";
  const kTitlePadding = 30;
  const width = Math.ceil(measureText(title)) + kTitlePadding;
  const [isEditing, setIsEditing] = useState(false);
  const [editingTitle, setEditingTitle] = useState(title);
  // Ref mirrors editingTitle so handleClose can read the latest value synchronously
  // after voice typing commits interim text (React 17 batches state updates).
  const editingTitleRef = useRef(editingTitle);
  editingTitleRef.current = editingTitle;

  const handleClick = () => {
    if (!readOnly && !isEditing) {
      onBeginEdit?.();
      setEditingTitle(title);
      editingTitleRef.current = title;
      setIsEditing(true);

      // Register a text inserter so the voice typing button can update the title
      if (onRegisterTextInserter) {
        const inserter: TitleTextInserter = (text, cursorPos) => {
          editingTitleRef.current = text;
          setEditingTitle(text);
        };
        onRegisterTextInserter(inserter);
      }
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
    // Commit any pending interim voice typing text before saving
    onBeforeClose?.();
    const trimTitle = editingTitleRef.current?.trim();
    // This automatically logs the change
    trimTitle && model?.setTitleOrContentTitle(trimTitle);
    onRegisterTextInserter?.(null);
    onEndEdit?.(accept && trimTitle ? trimTitle : undefined);
    setIsEditing(false);
  };
  const isDefaultTitle = title && /Graph\s+(\d+)\s*$/.test(title);
  const classes = classNames("editable-tile-title", className,
                            { "editable-tile-title-editing": isEditing,
                            "editable-tile-title-default": isDefaultTitle });
  const containerStyle: React.CSSProperties = { width };
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
