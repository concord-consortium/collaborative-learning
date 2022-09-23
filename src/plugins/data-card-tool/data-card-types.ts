export const kDataCardToolID = "DataCard";

export const kDataCardDefaultHeight = 320;

export const kDefaultLabelPrefix = "Label";
export const kDefaultLabel = `${kDefaultLabelPrefix} 1`;

export const looksLikeDefaultLabel = (label: string) => {
  return label.startsWith(kDefaultLabelPrefix);
};

export type EditFacet = "name" | "value" | "";