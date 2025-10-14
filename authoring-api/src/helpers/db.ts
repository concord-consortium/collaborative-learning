import admin from "firebase-admin";

export type UnitFiles = Record<string, UnitFile>;
export interface UnitFile {
  sha: string;
  type?: string;
  title?: string;
}

export interface UnitMetadata {
  pulledAt: typeof admin.database.ServerValue.TIMESTAMP
  updates?: Record<string, typeof admin.database.ServerValue.TIMESTAMP>;
}

export type BranchesMetadata = Record<string, BranchMetadata>;

export interface BranchMetadata {
  units: Record<string, UnitMetadata>
}

export const getDb = () => admin.database();

export const authoringPath = "authoring";

export const getUnitPath = (branch: string, unit: string) =>
  `${authoringPath}/content/branches/${branch}/units/${unit}`;

export const getUnitFilesPath = (branch: string, unit: string, path: string = "") =>
  `${getUnitPath(branch, unit)}/files${path ? `/${path}` : ""}`;

export const getUnitUpdatesPath = (branch: string, unit: string, path: string = "") =>
  `${getUnitPath(branch, unit)}/updates${path ? `/${path}` : ""}`;

export const getBranchesMetadataPath = (branch?: string) =>
  `${authoringPath}/metadata/branches${branch ? `/${branch}` : ""}`;

export const getUnitMetadataPath = (branch: string, unit: string, path: string = "") =>
  `${getBranchesMetadataPath(branch)}/units/${unit}${path ? `/${path}` : ""}`;

export const getUnitMetadataUpdatesPath = (branch: string, unit: string, path: string = "") =>
  `${getBranchesMetadataPath(branch)}/units/${unit}/updates${path ? `/${path}` : ""}`;

export const getBlobCachePath = (sha?: string) =>
  `${authoringPath}/blobs${sha ? `/${sha}` : ""}`;

export function escapeFirebaseKey(key: string): string {
  return key.replace(/[.#$[\]/]/g, (char) => {
    switch (char) {
    case ".":
      return "%2E";
    case "#":
      return "%23";
    case "$":
      return "%24";
    case "[":
      return "%5B";
    case "]":
      return "%5D";
    case "/":
      return "%2F";
    default:
      return "";
    }
  });
}

export function unescapeFirebaseKey(escapedKey: string): string {
  return escapedKey.replace(/%2E|%23|%24|%5B|%5D|%2F/g, (escapedChar) => {
    switch (escapedChar) {
    case "%2E":
      return ".";
    case "%23":
      return "#";
    case "%24":
      return "$";
    case "%5B":
      return "[";
    case "%5D":
      return "]";
    case "%2F":
      return "/";
    default:
      return "";
    }
  });
}
