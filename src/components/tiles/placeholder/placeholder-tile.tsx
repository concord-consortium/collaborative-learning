import React from "react";
import { useAppConfig, useUIStore } from "../../../hooks/use-stores";
import { getSectionPlaceholder } from "../../../models/curriculum/section";
import { PlaceholderContentModelType } from "../../../models/tiles/placeholder/placeholder-content";
import { ITileProps } from "../tile-component";

import "./placeholder-tile.scss";

export const kDefaultPlaceholder = "No placeholder content is configured.";

const PlaceholderTileComponent: React.FC<ITileProps> = (props) => {
  const ui = useUIStore();
  const appConfig = useAppConfig();

  const handleMouseDown = (e: React.MouseEvent) => {
    ui.setSelectedTile();
  };

  const renderPlaceholderText = () => {
    const content = props.model.content as PlaceholderContentModelType;
    const { sectionId, containerType } = content;
    let placeholderText = undefined;
    // First see if there is a section-specific placeholder
    if (containerType === "DocumentContent") {
      placeholderText = getSectionPlaceholder(sectionId);
    }
    // If there is no section-specific placeholder, use the app-config placeholder
    if (!placeholderText) {
      placeholderText = appConfig.getPlaceholder(containerType) || kDefaultPlaceholder;
    }
    const placeholderLines = placeholderText.split("\n");
    return (
      <div>
        {placeholderLines.map((line, index) => (
          <div key={index}>{line}</div>
        ))}
      </div>
    );
  };

  return (
    <div className="placeholder-tool" onMouseDown={handleMouseDown}>
      {renderPlaceholderText()}
    </div>
  );
};

export default PlaceholderTileComponent;
