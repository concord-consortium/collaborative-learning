import { DEBUG_LOADING } from "../lib/debug";


const sessionStorageStartTimeItem = 'loading-time-start';
const sessionStorageMessageItem = 'loading-message';
const messageSeparator = '<br/>';

const loadingMeasurements: Record<string, number> = {}; //holds start and stop timestamps of each performance message

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
    console.log(`Loading @${timeStamp}ms: ${msg}`);
  }
  const existingMessages = sessionStorage.getItem(sessionStorageMessageItem);
  sessionStorage.setItem('loading-message', existingMessages + msg + messageSeparator);
  const msgStart = msg + " Start";
  loadingMeasurements[msgStart] = timeStamp; //start time
}

export function removeLoadingMessage(msg: string) {
  const timeStamp = getTimestamp();
  if (timeStamp === null) {
    console.error(`Timestamp for message "${msg}" is null.`);
    return;
  }
  if (DEBUG_LOADING) {
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
  return {loadingMeasurements};
}


