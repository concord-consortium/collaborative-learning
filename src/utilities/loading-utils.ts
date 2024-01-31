import { DEBUG_LOADING } from "../lib/debug";

const sessionStorageStartTimeItem = 'loading-time-start';
const sessionStorageMessageItem = 'loading-message';
const messageSeparator = '<br/>';

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
    // eslint-disable-next-line no-console
    console.log(`Loading @${getTimestamp()}ms: ${msg}`);
  }
  const existingMessages = sessionStorage.getItem(sessionStorageMessageItem);
  sessionStorage.setItem('loading-message', existingMessages + msg + messageSeparator);
}

export function removeLoadingMessage(msg: string) {
  if (DEBUG_LOADING) {
    // eslint-disable-next-line no-console
    console.log(`Loading @${getTimestamp()}ms: Done with: ${msg}`);
  }
  const existingMessages = sessionStorage.getItem(sessionStorageMessageItem);
  if (existingMessages) {
    sessionStorage.setItem('loading-message', existingMessages.replace(msg + messageSeparator, ''));
  }
}
