export const kDataCardTileType = "DataCard";
export const kDataCardDroppableId = `datacard-droppable`;
export const kDataCardDraggableId = `datacard-draggable`;


export const kDataCardDefaultHeight = 180;

export const kDefaultLabelPrefix = "Label";
export const kDefaultLabel = `${kDefaultLabelPrefix} 1`;

export const looksLikeDefaultLabel = (label: string) => {
  return label.startsWith(kDefaultLabelPrefix);
};

export type EditFacet = "name" | "value" | "";


export const dataCardDraggableId = (tileId: string) =>
  `${kDataCardDraggableId}_${tileId}`;

export const dataCardDroppableId = (tileId: string) =>
  `${kDataCardDroppableId}_${tileId}`;
