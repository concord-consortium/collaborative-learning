import React, { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { createPortal } from "react-dom";
import { useStores } from "../hooks/use-stores";
import { getTileComponentInfo } from "../models/tiles/tile-component-info";
import dragPlaceholderImage from "../assets/image_drag.png";

export const PickedUpTileGhost: React.FC = observer(function PickedUpTileGhost() {
  const { ui, documents } = useStores();
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!ui.pickedUpTileId) return;

    // Initialize ghost position near the drag handle that triggered the pick-up.
    // When picked up via keyboard (Tab + Enter), the active element is the drag handle.
    // When picked up via mouse click, the mouse position is already reasonable.
    const activeEl = document.activeElement as HTMLElement | null;
    const handle = activeEl?.closest(".tool-tile-drag-handle-wrapper") || activeEl;
    if (handle) {
      const rect = handle.getBoundingClientRect();
      setPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    }

    document.body.classList.add("tile-picked-up");

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        ui.clearPickedUpTile();
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Don't cancel if clicking a drag handle (toggle handler handles it)
      if (target.closest(".tool-tile-drag-handle-wrapper")) return;
      // Don't cancel if clicking the delete button (delete handler will handle it)
      if (target.closest(".delete-button")) return;
      // Don't cancel if clicking inside document content (placement handler handles it)
      if (target.closest(".document-content")) return;
      // Everything else cancels pick-up
      ui.clearPickedUpTile();
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleMouseDown, true);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleMouseDown, true);
      document.body.classList.remove("tile-picked-up");
    };
  }, [ui, ui.pickedUpTileId]);

  if (!ui.pickedUpTileId) return null;

  // Look up the tile type icon from the tile component registry
  const sourceDoc = documents.findDocumentOfTile(ui.pickedUpTileId);
  const tileType = sourceDoc?.content?.getTileType(ui.pickedUpTileId);
  const TileIcon = tileType ? getTileComponentInfo(tileType)?.Icon : undefined;

  const ghost = (
    <>
      <div style={{
        position: "fixed",
        left: position.x - 80,
        top: position.y - 4,
        width: 80,
        height: 80,
        pointerEvents: "none",
        zIndex: 10000,
      }}>
        <img
          src={dragPlaceholderImage}
          alt=""
          style={{ width: 80, height: 80, opacity: 0.8 }}
        />
        {TileIcon && (
          <TileIcon style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: 32,
            height: 32,
          }} />
        )}
      </div>
      <div aria-live="assertive" role="status"
        style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}>
        Tile picked up. Use arrow keys to choose a position, Enter to place, Escape to cancel.
      </div>
    </>
  );

  return createPortal(ghost, document.body);
});
