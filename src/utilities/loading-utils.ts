import { DocumentsModelType } from "../models/stores/documents";
import { DocumentModelType } from "../models/document/document";
import { SectionModelType } from "../models/curriculum/section";

import { DEBUG_LOADING } from "../lib/debug";
import { LogEventName } from "../lib/logger-types";
import { Logger } from "../lib/logger";

const sessionStorageStartTimeItem = 'loading-time-start';
const sessionStorageMessageItem = 'loading-message';
const messageSeparator = '<br/>';

//loadingMeasurements is a global object (declared in index.html)
//keys are action start and end labels, values are milliseconds
declare global {
  interface Window { loadingMeasurements: Record<string, number> }
}
const loadingMeasurements = window.loadingMeasurements;

function getTimestamp() {
  const start = sessionStorage.getItem(sessionStorageStartTimeItem);
  if (!start) {
    return null;
  }
  return Math.floor(performance.now()-Number.parseFloat(start));
}

export function getCurrentLoadingMessage() {
  return sessionStorage.getItem(sessionStorageMessageItem) || '...';
}

export function showLoadingMessage(msg: string) {
  const timeStamp = getTimestamp();
  if(timeStamp === null) {
    console.error(`Timestamp for message "${msg}" is null.`);
    return;
  }
  if (DEBUG_LOADING) {
    // eslint-disable-next-line no-console
    console.log(`Loading @${timeStamp}ms: ${msg}`);
  }
  const existingMessages = sessionStorage.getItem(sessionStorageMessageItem);
  sessionStorage.setItem('loading-message', existingMessages + msg + messageSeparator);
  const msgStart = msg + " Start";
  loadingMeasurements[msgStart] = timeStamp; //Start time
}

export function removeLoadingMessage(msg: string) {
  const timeStamp = getTimestamp();
  if (timeStamp === null) {
    console.error(`Timestamp for message "${msg}" is null.`);
    return;
  }
  if (DEBUG_LOADING) {
    // eslint-disable-next-line no-console
    console.log(`Loading @${timeStamp}ms: Done with: ${msg}`);
  }
  const existingMessages = sessionStorage.getItem(sessionStorageMessageItem);
  if (existingMessages) {
    sessionStorage.setItem('loading-message', existingMessages.replace(msg + messageSeparator, ''));
  }
  const msgEnd = msg + " End";
  loadingMeasurements[msgEnd] = timeStamp; //End time
}

export function getLoadingMeasurements(){
  return { loadingMeasurements };
}


export function logLoadingAndDocumentMeasurements(documents: DocumentsModelType,
  curriculumDocSections: SectionModelType[],
  primaryDocument?: DocumentModelType ){
  const startTime = performance.now();

  const totalNumDocumentsLoaded = documents.all.length;
  const totalNumTilesLoaded = documents.all.reduce((total: number, doc: DocumentModelType) => {
    return total + (doc.content?.tileMap.size || 0);
  }, 0);

  const primaryDocTilesByType = primaryDocument?.content?.getAllTilesByType();
  // getAllTilesByType returns a map with the tileKeys as values, we want to convert this to the length
  const primaryDocNumTilesByType = primaryDocTilesByType && countTileKeys(primaryDocTilesByType);

  function countTileKeys(tilesByType: Record<string, string[]>): Record<string, number> {
    const tileCounts: Record<string, number>= {};
    for (const tileType of Object.keys(tilesByType)) {
      tileCounts[tileType] = tilesByType[tileType].length;
    }
    return tileCounts;
  }

  // ----------------------- Curriculum Documents Summary  --------------------------------------
  const curriculumSectionsTilesByType = curriculumDocSections.map((section) => {
    const sectionDocTilesByType = section.content?.getAllTilesByType() as any;
    const sectionDocNumTilesByType = countTileKeys(sectionDocTilesByType);
    return sectionDocNumTilesByType;
  });

  //Convert curriculumSectionsTileByType further and count all tiles in each section
  const curriculumSumTileTypes: Record<string, number> = {};
  curriculumSectionsTilesByType.forEach((section) => {
    Object.keys(section).forEach((tileType) => {
      if(!curriculumSumTileTypes[tileType]) {
        curriculumSumTileTypes[tileType] = 0; //Create entry
      }
      curriculumSumTileTypes[tileType] += section[tileType];
    });
  });

  const documentMeasurements = {
    totalNumDocumentsLoaded,
    totalNumTilesLoaded,
    primaryDocNumTilesByType,
    curriculumSumTileTypes,
  };

  const finalLogObject = {
    loadingMeasurements,
    documentMeasurements
  };

  const endTime = performance.now();
  if(DEBUG_LOADING) {
    // eslint-disable-next-line no-console
    console.log(`logLoadingAndDocumentMeasurements executed in ${endTime - startTime} milliseconds`);
  }

  Logger.log(LogEventName.LOADING_MEASUREMENTS, finalLogObject);
}
