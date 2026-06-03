import React, { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { createPortal } from "react-dom";
import { useStores } from "../hooks/use-stores";
import { getTileComponentInfo } from "../models/tiles/tile-component-info";
import dragPlaceholderImage from "../assets/image_drag.png";

const kGhostSize = 80;
const kGhostIconSize = 32;
const kGhostOffsetX = -kGhostSize; // anchor at top-right corner
const kGhostOffsetY = -4;
const kGhostZIndex = 10000;

export const PickedUpTileGhost: React.FC = observer(function PickedUpTileGhost() {
  const { ui } = useStores();
  const [position, setPosition] = useState({ x: 0, y: 0 });

  // Follow the focused drop zone position during keyboard navigation
  useEffect(() => {
    if (ui.focusedDropZoneX != null && ui.focusedDropZoneY != null) {
      setPosition({ x: ui.focusedDropZoneX, y: ui.focusedDropZoneY });
    }
  }, [ui.focusedDropZoneX, ui.focusedDropZoneY]);

  useEffect(() => {
    if (!ui.pickedUpTileId) return;

    // Initialize ghost position near the pick-up origin.
    if (ui.pickedUpX != null && ui.pickedUpY != null) {
      // Mouse click — use stored coordinates
      setPosition({ x: ui.pickedUpX, y: ui.pickedUpY });
    } else {
      // Keyboard pick-up — use focused element position
      const activeEl = document.activeElement as HTMLElement | null;
      const handle = activeEl?.closest(".tool-tile-drag-handle-wrapper") || activeEl;
      if (handle) {
        const rect = handle.getBoundingClientRect();
        setPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
      }
    }

    document.body.classList.add("tile-picked-up");

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
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
    document.addEventListener("mousedown", handleMouseDown, true);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mousedown", handleMouseDown, true);
      document.body.classList.remove("tile-picked-up");
    };
  }, [ui, ui.pickedUpTileId]);

  if (!ui.pickedUpTileId) return null;

  // Look up the tile type icon from the tile component registry
  const TileIcon = ui.pickedUpTileType ? getTileComponentInfo(ui.pickedUpTileType)?.Icon : undefined;

  const ghost = (
    <>
      <div style={{
        position: "fixed",
        left: position.x + kGhostOffsetX,
        top: position.y + kGhostOffsetY,
        width: kGhostSize,
        height: kGhostSize,
        pointerEvents: "none",
        zIndex: kGhostZIndex,
      }}>
        <img
          src={dragPlaceholderImage}
          alt=""
          style={{ width: kGhostSize, height: kGhostSize, opacity: 0.8 }}
        />
        {TileIcon && (
          <TileIcon style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: kGhostIconSize,
            height: kGhostIconSize,
          }} />
        )}
      </div>
      <div aria-live="assertive" role="status" className="visually-hidden">
        Tile picked up. Use arrow keys to choose a position, Enter to place, Escape to cancel.
      </div>
    </>
  );

  return createPortal(ghost, document.body);
});
