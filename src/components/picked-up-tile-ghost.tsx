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

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.classList.remove("tile-picked-up");
    };
  }, [ui, ui.pickedUpTileId]);

  if (!ui.pickedUpTileId) return null;

  const ghost = (
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
  );

  return createPortal(ghost, document.body);
});
