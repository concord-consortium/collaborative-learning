import { parse } from "query-string";
import { getAssetUrl } from "./asset-utils";
import { reprocessUrlParams } from "./url-params";

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
 * be relative Webpack public path. This public path is typically
 * the location of the built javascript and css files.
 *
 * @param param
 * @returns
 */
export function getUrlFromRelativeOrFullString(param: string) {
  if (param.startsWith("./")) {
    const assetUrlString = getAssetUrl(param);
    if (assetUrlString === param) {
      // This means the webpack public path isn't set so just use window.location
      // This will should only happen during tests
      return new URL(param, window.location.href);
    } else {
      return new URL(assetUrlString);
    }
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

/**
 * Simplifies query-string library by only returning `string | undefined`, instead
 * of `string | string[] | null | undefined`.
 * @param prop
 */
export function hashValue(prop: string): string | undefined {
  const query = parse(window.location.hash);
  const val = query[prop];
  if (!val) {
    return undefined;
  }
  if (Array.isArray(val)) {
    throw `May only have one hash parameter for ${prop}. Found: ${val}`;
  }
  return val;
}


export function addUrlParams(params: Record<string, string | number | boolean>) {
  const url = new URL(window.location.href);
  const searchParams = new URLSearchParams(url.search);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      searchParams.set(key, String(value));
    }
  });
  url.search = searchParams.toString();
  window.history.replaceState(null, "CLUE", url.toString());
  reprocessUrlParams();
}
