import classNames from "classnames";
import React, { useCallback, useRef, useState } from "react";
import { observer } from "mobx-react";
import { IButtonProps } from "./toolbar-button";
import { useCautionAlert } from "./utilities/use-caution-alert";
import { useStores } from "../hooks/use-stores";
import { kDragTileId, kDragTiles } from "./tiles/tile-component";

interface IProps extends IButtonProps {
  onSetShowDeleteTilesConfirmationAlert: (showAlert: () => void) => void;
  onDeleteSelectedTiles: () => void;
  onDeleteTile: (tileId: string) => void;
}

export const DeleteButton: React.FC<IProps> = observer(
  ({ toolButton, isActive, isDisabled, onSetToolActive, onClick,
      onSetShowDeleteTilesConfirmationAlert, onDeleteSelectedTiles, onDeleteTile }) => {

  const { ui } = useStores();
  const { id, title, Icon } = toolButton;
  const [isDragOver, setIsDragOver] = useState(false);
  const dragTileIdRef = useRef<string | null>(null);

  const handleMouseDown = () => {
    !isDisabled && onSetToolActive(toolButton, true);
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    // If a tile is picked up, treat click as delete-via-pick-up
    if (ui.pickedUpTileId) {
      dragTileIdRef.current = ui.pickedUpTileId;
      ui.clearPickedUpTile();
      showDragDeleteAlert();
      return;
    }
    !isDisabled && onClick(e, toolButton);
  };

  // Click-to-delete: deletes all selected tiles
  const ClickDeleteAlertContent = () => {
    return <p>Remove the selected tile(s) from the document? This action is not undoable.</p>;
  };
  const [showClickDeleteAlert] = useCautionAlert({
    title: "Delete Tiles",
    content: ClickDeleteAlertContent,
    confirmLabel: "Delete Tiles",
    onConfirm: () => onDeleteSelectedTiles()
  });
  onSetShowDeleteTilesConfirmationAlert(showClickDeleteAlert);

  // Drag-to-delete: deletes only the dragged tile
  const DragDeleteAlertContent = () => {
    return <p>Remove this tile from the document? This action is not undoable.</p>;
  };
  const [showDragDeleteAlert] = useCautionAlert({
    title: "Delete Tile",
    content: DragDeleteAlertContent,
    confirmLabel: "Delete Tile",
    onConfirm: () => {
      if (dragTileIdRef.current) {
        onDeleteTile(dragTileIdRef.current);
        dragTileIdRef.current = null;
      }
    }
  });

  const hasTileDrag = useCallback((e: React.DragEvent) => {
    return e.dataTransfer.types.includes(kDragTiles);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLButtonElement>) => {
    if (hasTileDrag(e)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    }
  }, [hasTileDrag]);

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLButtonElement>) => {
    if (hasTileDrag(e)) {
      e.preventDefault();
      setIsDragOver(true);
    }
  }, [hasTileDrag]);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLButtonElement>) => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    // kDragTileId is only set for single-tile drags; container tiles (e.g. question tiles)
    // include embedded tiles in the drag data, so kDragTileId is not set.
    // Fall back to the first tile in kDragTiles, which is the container tile itself.
    let tileId = e.dataTransfer.getData(kDragTileId);
    if (!tileId) {
      try {
        const dragTilesJson = e.dataTransfer.getData(kDragTiles);
        const dragTilesData = JSON.parse(dragTilesJson);
        tileId = dragTilesData?.tiles?.[0]?.tileId;
      } catch (ex) {
        // ignore parse errors
      }
    }
    if (tileId) {
      dragTileIdRef.current = tileId;
      showDragDeleteAlert();
    }
  }, [showDragDeleteAlert]);

  const classes = classNames("tool", "delete-button", id,
                            { active: isActive || isDragOver }, isDisabled ? "disabled" : "enabled");
  return (
    <button
      aria-disabled={isDisabled || undefined}
      aria-label={title}
      className={classes}
      data-testid="delete-button"
      title={title}
      type="button"
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {Icon && <Icon />}
    </button>
  );
});
