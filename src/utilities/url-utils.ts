// Adapted from https://stackoverflow.com/a/43467144
export function isValidHttpUrl(possibleUrl: string | undefined) {
  try {
    const url = possibleUrl ? new URL(possibleUrl) : undefined;
    return url?.protocol === "http:" || url?.protocol === "https:";
  } catch (_) {
    return false;
  }
}

/**
 * This returns a URL object only if the param starts with "./" or
 * a protocol of http or https. If it starts with "./" the URL will
 * be relative to the current browser location
 *
 * @param param
 * @returns
 */
export function getUrlFromRelativeOrFullString(param: string) {
  if (param.startsWith("./")) {
    return new URL(param, window.location.href);
  } else if (isValidHttpUrl(param)) {
    return new URL(param);
  }
}

export function getUnitCodeFromUrl(url: string) {
  const urlParts = url.split("/");
  const unitCode = urlParts[urlParts.length-2];
  return unitCode;
}

export function getUnitCodeFromUnitParam(param: string) {
  return getUrlFromRelativeOrFullString(param) ? getUnitCodeFromUrl(param) : param;
}
