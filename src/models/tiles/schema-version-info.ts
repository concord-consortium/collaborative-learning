/**
 * Lets a tile or shared model type say which version of its saved JSON is current and how to
 * convert older versions. Old JSON can then be converted outside MST, and the conversion recorded
 * in history.
 */
export interface ISchemaVersionInfo {
  currentVersion: string;
  // The whole TileModel JSON for tiles; the shared model JSON for shared models.
  getVersion: (json: any) => string;
  // Converts any older version to currentVersion. JSON that is already current is returned unchanged.
  convertSnapshot: (json: any) => any;
}
