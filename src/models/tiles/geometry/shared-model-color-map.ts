import { SharedModelType } from "../../shared/shared-model";
import { DocumentContentModelType } from "../../document/document-content";
import styles from "../table-links.scss";

interface ColorSet {
  fill: string,
  stroke: string,
  selectedFill: string,
  selectedStroke: string
}

interface colorMapping {
  tableId?: string,
  sharedModelId: string,
  colorSet: ColorSet
  indexOfType: number
}

export interface SharedModelWithProvider extends SharedModelType {
  providerId: string
}

const fallBackColorSet = {
  fill: styles.linkColor0Light, stroke: styles.linkColor0Dark,
  selectedFill: styles.linkColor0Dark, selectedStroke: styles.linkColor0Dark
};

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

export const colorMap = new Map<string, colorMapping>;

export function setColorMapEntry(anyId: string, mappingObj: colorMapping){
  return colorMap.set(anyId, mappingObj) || fallBackColorSet;
}

export function getColorMapEntry(anyId: string){
  return colorMap.get(anyId);
}

export function maintainSharedModelsColorMap(sharedModels: SharedModelWithProvider[]){
  sharedModels.forEach((m:any) => {
    setColorMapEntryPair(m);
  });
}

export function setColorMapEntryPair(sharedModel: SharedModelWithProvider) {
  const mappingObj = {
    tableId: sharedModel.providerId,
    sharedModelId: sharedModel.id,
    indexOfType: sharedModel.indexOfType,
    colorSet: colorSets[sharedModel.indexOfType]
  };
  // set entries with duplicate values - one with tableId as key, one with sharedModel as key
  // This is in anticipation of future access from non-table originated models
  setColorMapEntry(sharedModel.providerId, mappingObj);
  setColorMapEntry(sharedModel.id, mappingObj);
}

export function assignIndexOfType(sharedModel: SharedModelWithProvider, document: DocumentContentModelType) {
  if (sharedModel.indexOfType < 0) {
    const usedIndices = new Set<number>();
    const sharedModels = document.getSharedModelsByType(sharedModel.type);
    sharedModels?.forEach(model => {
      if (model.indexOfType >= 0) {
        usedIndices.add(model.indexOfType);
      }
    });

    for (let i = 1; sharedModel.indexOfType < 0; ++i) {
      if (!usedIndices.has(i)) {
        // reassignment of existing indexOfType
        sharedModel.setIndexOfType(i);
        break;
      }
    }
  }
}
