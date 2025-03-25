import React, { useContext } from "react";
import { TileModelContext } from "./tile-api";
import { TileTitleArea } from "./tile-title-area";

import "./read-only-tile-title.scss";

export function ReadOnlyTileTitle() {
  const model = useContext(TileModelContext);
  const title = model?.computedTitle || "Tile Title";

  return (
    <TileTitleArea>
      <div className="read-only-title">{title}</div>
    </TileTitleArea>
  );
}
