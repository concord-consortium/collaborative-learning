import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptsRoot = path.resolve(__dirname, "..");

// _duration should be in miliseconds
export function prettyDuration(_duration: number) {
  const miliseconds = _duration % 1000;
  const totalSeconds = Math.floor(_duration / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  const hourPart = hours > 0 ? `${hours}:` : "";
  const minutePart = hourPart || minutes > 0 ? `${minutes}:` : "";
  const secondPart = minutePart || seconds > 0 ? `${seconds}.` : "";
  return `${hourPart}${minutePart}${secondPart}${miliseconds}`;
}

export function getFirebaseBasePath(portal: string, demo?: string | boolean) {
  return demo
    ? `/demo/${demo}/portals/demo/classes`
    : `/authed/portals/${portal?.replace(/\./g, "_")}/classes`;
}

export function getFirestoreBasePath(portal: string, demo?: string | boolean) {
  return demo
    ? `demo/${demo}/documents`
    : `authed/${portal.replace(/\./g, "_")}/documents`;
}

export function getFirestoreUsersPath(portal: string, demo?: string | boolean) {
  return demo
    ? `demo/${demo}/users`
    : `authed/${portal.replace(/\./g, "_")}/users`;
}

export function getFirestoreClassesPath(portal: string, demo?: string | boolean) {
  return demo
    ? `demo/${demo}/classes`
    : `authed/${portal.replace(/\./g, "_")}/classes`;
}

export function getScriptRootFilePath(filename: string) {
  return path.resolve(scriptsRoot, filename);
}

// eslint-disable-next-line prefer-regex-literals
const clueBranchRegExp = new RegExp("^https://[^/]*(/[^?]*)");
export function getClueBranch(activityUrl: string) {
  return clueBranchRegExp.exec(activityUrl)?.[1];
}

// eslint-disable-next-line prefer-regex-literals
const unitParamRegExp = new RegExp("unit=([^&]*)");
export function getUnitParam(activityUrl: string) {
  return unitParamRegExp.exec(activityUrl)?.[1];
}

// eslint-disable-next-line prefer-regex-literals
const unitBranchRegExp = new RegExp("/branch/[^/]*");
export function getUnitBranch(unitParam: string | undefined) {
  if (unitParam?.startsWith("https://")) {
    return unitBranchRegExp.exec(unitParam)?.[0];
  } else {
    return "";
  }
}

// eslint-disable-next-line prefer-regex-literals
const unitCodeRegExp = new RegExp("/([^/]*)/content.json");
export function getUnitCode(unitParam: string | undefined) {
  if (unitParam?.startsWith("https://")) {
    const unitCode = unitCodeRegExp.exec(unitParam)?.[1];
    return unitCode ? unitCode : null;
  } else {
    return unitParam ? unitParam : null;
  }
}

export function getProblemDetails(url: string) {
  const activityURL = new URL(url);
  const urlParams = activityURL.searchParams;
  const unitParam = urlParams.get("unit");
  // The unit param's value may be a unit code or a full url, so we make sure to get just the unit code
  const unit = getUnitCode(unitParam);
  const investigationAndProblem = urlParams.get("problem");
  const [investigation, problem] = investigationAndProblem ? investigationAndProblem.split(".") : [null, null];
  return { investigation, problem, unit };
}

/**
 * Create a new Record based on a passed in Record. The keys in the new Record
 * are computed by the passed in getNewKey function.
 * If getNewKey returns a falsely value the entry is skipped and it is logged
 * to the console.
 *
 * @param originalMap
 * @param getNewKey
 * @returns
 */
export function remap(
  originalMap: Record<string, any>,
  getNewKey: (value: any) => string | undefined
) {
  if (!originalMap) return undefined;
  const newMap = {};
  for (const [originalKey, value] of Object.entries(originalMap)) {
    const newKey = getNewKey(value);
    if (!newKey) {
      console.log("Invalid value found: ", originalKey, value);
      continue;
    }
    newMap[newKey] = value;
  }
  return newMap;
}

/**
 * Firebase publications are stored with different keys than their document
 * id for some reason. In some cases the real document id is in self.documentKey
 * so we make a map with that documentKey as the key of the map.
 *
 * @param fbPublications
 */
export function remapFirebaseClassPublications(fbPublications: Record<string, any>) {
  return remap(fbPublications, (metadata) => metadata?.self?.documentKey);
}

/**
 * Firebase publications are stored with different keys than their document
 * id for some reason. In some cases the real document id is in documentKey
 * so we make a map with that documentKey as the key of the map.
 * @param fbPublications
 */
export function remapFirebaseProblemDocPublications(fbPublications: Record<string, any>) {
  return remap(fbPublications, (metadata) => metadata?.documentKey);
}
