export const kDataCardTileType = "DataCard";

export const kDataCardDefaultHeight = 180;
export const kExampleDeckHeight = 410;
export const kButtonSpace = 70;

export const kDefaultLabelPrefix = "Label";
export const kDefaultLabel = `${kDefaultLabelPrefix} 1`;
export const kFieldWidthFactor = 120; // passed to measureTextLines
export const kNameCharsLimit = 60;
export const kValueCharsLimit = 80;
export const kSortImgHeight = 60;

export const looksLikeDefaultName = (label: string) => {
  return label.startsWith(kDefaultLabelPrefix);
};

export type EditFacet = "name" | "value" | "";
