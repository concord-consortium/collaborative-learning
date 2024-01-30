import { DEBUG_LOADING } from "../lib/debug";
import { LogEventName } from "../lib/logger-types";
import { Logger } from "../lib/logger";

const sessionStorageStartTimeItem = 'loading-time-start';
const sessionStorageMessageItem = 'loading-message';
const messageSeparator = '<br/>';

//Logging
const loadingMeasurements: Record<string, number | string> = {};
//Buildingworkspace
//Connecting
//Initializing
//Joining group
//Loading curriculum content
//Loading the application
//Loading tile types
//Setting up curriculum content


function getTimestamp() {
  const start = sessionStorage.getItem(sessionStorageStartTimeItem);
  if (!start) {
    return "??";
  }
  return Math.floor(performance.now()-Number.parseFloat(start));
}

export function getCurrentLoadingMessage() {
  return sessionStorage.getItem(sessionStorageMessageItem) || '...';
}

export function showLoadingMessage(msg: string) {
  if (DEBUG_LOADING) {
    console.log(`Loading @${getTimestamp()}ms: ${msg}`);
  }
  const existingMessages = sessionStorage.getItem(sessionStorageMessageItem);
  sessionStorage.setItem('loading-message', existingMessages + msg + messageSeparator);
}

export function removeLoadingMessage(msg: string) {
  const timeStamp = getTimestamp();

  if (DEBUG_LOADING) {
    console.log(`Loading @${timeStamp}ms: Done with: ${msg}`);
  }
  const existingMessages = sessionStorage.getItem(sessionStorageMessageItem);
  if (existingMessages) {
    sessionStorage.setItem('loading-message', existingMessages.replace(msg + messageSeparator, ''));
  }
  loadingMeasurements[msg] = timeStamp;
}

export function printOutAllMeasurements(){
  console.log("loadingMeasurements:", loadingMeasurements);
  Logger.log(LogEventName.LOADING_MEASUREMENTS, loadingMeasurements);
}


