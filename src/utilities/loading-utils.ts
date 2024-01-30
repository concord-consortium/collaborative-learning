import { DEBUG_LOADING } from "../lib/debug";
import { LogEventName } from "../lib/logger-types";
import { Logger } from "../lib/logger";
// import { useStores } from "src/hooks/use-stores";


const sessionStorageStartTimeItem = 'loading-time-start';
const sessionStorageMessageItem = 'loading-message';
const messageSeparator = '<br/>';

const loadingMeasurements: Record<string, number> = {};

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

export function finishLoadingLogAllMeasurements(){
  //log message should include
  //•Performance metrics (loading measurements)
  //•Class/Unit/Problem/User(should already exist)
  //TODO:
  //HTTP2 or higher?
  //Number of docs loaded
  //Total # of tiles loaded
  //Summary of document on the right
  //Summary of the loaded curriculum documents

  //Find total # of docs
  // const { documents } = useStores();


  Logger.log(LogEventName.LOADING_MEASUREMENTS, {loadingMeasurements});
}


