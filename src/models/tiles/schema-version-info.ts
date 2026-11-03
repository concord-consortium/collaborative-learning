/**
 * Lets a tile or shared model type say which version of its saved JSON is current and how to
 * convert older versions. History playback uses it to cross schema changes.
 */
export interface ISchemaVersionInfo {
  currentVersion: string;
  // The whole TileModel JSON for tiles; the shared model JSON for shared models.
  getVersion: (json: any) => string;
  // Converts any older version to currentVersion. JSON that is already current is returned unchanged.
  convertSnapshot: (json: any) => any;
}
