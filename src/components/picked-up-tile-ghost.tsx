import React, { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { createPortal } from "react-dom";
import { useStores } from "../hooks/use-stores";
import dragPlaceholderImage from "../assets/image_drag.png";

export const PickedUpTileGhost: React.FC = observer(function PickedUpTileGhost() {
  const { ui } = useStores();
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!ui.pickedUpTileId) return;

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

  const ghost = (
    <>
      <img
        src={dragPlaceholderImage}
        alt=""
        style={{
          position: "fixed",
          left: position.x - 40,
          top: position.y - 10,
          pointerEvents: "none",
          opacity: 0.8,
          zIndex: 10000,
        }}
      />
      <div aria-live="assertive" role="status"
        style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}>
        Tile picked up. Use arrow keys to choose a position, Enter to place, Escape to cancel.
      </div>
    </>
  );

  return createPortal(ghost, document.body);
});
