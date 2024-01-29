const localStorageStartTimeItem = 'loading-time-start';
const localStorageMessageItem = 'loading-message';
const messageSeparator = '<br/>';

function getTimestamp() {
  const start = localStorage.getItem(localStorageStartTimeItem);
  if (!start) {
    return "??";
  }
  return Math.floor(performance.now()-Number.parseFloat(start));
}

export function getCurrentLoadingMessage() {
  return localStorage.getItem(localStorageMessageItem) || '...';
}

export function showLoadingMessage(msg: string) {
  console.log(`Loading sequence @${getTimestamp()}ms: ${msg}`);
  const existingMessages = localStorage.getItem(localStorageMessageItem);
  localStorage.setItem('loading-message', existingMessages + msg + messageSeparator);
}

export function removeLoadingMessage(msg: string) {
  console.log(`Loading sequence @${getTimestamp()}ms: Done with ${msg}`);
  const existingMessages = localStorage.getItem(localStorageMessageItem);
  if (existingMessages) {
    localStorage.setItem('loading-message', existingMessages.replace(msg + messageSeparator, ''));
  }
}
