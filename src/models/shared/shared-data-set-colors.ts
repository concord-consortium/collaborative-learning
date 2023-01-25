import { SharedDataSetType } from "./shared-data-set";
import styles from "../tiles/table-links.scss";

interface ColorSet {
  fill: string,
  stroke: string,
  selectedFill: string,
  selectedStroke: string
}

interface ColorMapEntry {
  tableId?: string,
  sharedModelId: string,
  colorSet: ColorSet
  indexOfType: number
}

// TODO - did original behavior specify a hover state color?
const colorSets = [
  {
    fill: styles.linkColor0Light, stroke: styles.linkColor0Dark,
    selectedFill: styles.linkColor0Dark, selectedStroke: styles.linkColor0Dark
  },
  {
    fill: styles.linkColor1Light, stroke: styles.linkColor1Dark,
    selectedFill: styles.linkColor1Dark, selectedStroke: styles.linkColor1Dark
  },
  {
    fill: styles.linkColor2Light, stroke: styles.linkColor2Dark,
    selectedFill: styles.linkColor2Dark, selectedStroke: styles.linkColor2Dark
  },
  {
    fill: styles.linkColor3Light, stroke: styles.linkColor3Dark,
    selectedFill: styles.linkColor3Dark, selectedStroke: styles.linkColor3Dark
  },
  {
    fill: styles.linkColor4Light, stroke: styles.linkColor4Dark,
    selectedFill: styles.linkColor4Dark, selectedStroke: styles.linkColor4Dark
  },
  {
    fill: styles.linkColor5Light, stroke: styles.linkColor5Dark,
    selectedFill: styles.linkColor5Dark, selectedStroke: styles.linkColor5Dark
  }
];

const colorMap = new Map<string, ColorMapEntry>;

function setColorMapEntry(anyId: string, mappingObj: ColorMapEntry) {
  colorMap.set(anyId, mappingObj);
}

export function getColorMapEntry(anyId: string) {
  return colorMap.get(anyId);
}

export function updateSharedDataSetColors(sharedModels: SharedDataSetType[]) {
  sharedModels.forEach(m => {
    setColorMapEntryPair(m);
  });
}

function setColorMapEntryPair(sharedModel: SharedDataSetType) {
  const mappingObj = {
    tableId: sharedModel.providerId,
    sharedModelId: sharedModel.id,
    indexOfType: sharedModel.indexOfType,
    colorSet: colorSets[sharedModel.indexOfType]
  };
  // set entries with duplicate values - one with tableId as key, one with sharedModel as key
  // This is in anticipation of future access from non-table originated models
  sharedModel.providerId && setColorMapEntry(sharedModel.providerId, mappingObj);
  setColorMapEntry(sharedModel.id, mappingObj);
}
