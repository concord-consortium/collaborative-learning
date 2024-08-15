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
