import { DEBUG_LOADING } from "../lib/debug";

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
