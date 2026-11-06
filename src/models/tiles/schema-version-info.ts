/**
 * Lets a tile or shared model type say which version of its saved JSON is current and how to
 * convert older versions. Old JSON can then be converted outside MST, and the conversion recorded
 * in history.
 */
export interface ISchemaVersionInfo {
  currentVersion: string;
  // The whole TileModel JSON for tiles; the shared model JSON for shared models.
  getVersion: (json: any) => string;
  /**
   * Converts JSON at an older version to currentVersion; what it returns must be at currentVersion.
   * JSON that is already current is returned unchanged. Returns undefined for JSON it can't handle,
   * such as JSON saved by a newer release. A declined model is treated as current: it loads through
   * MST as it would without a schemaVersion, and no conversion is recorded for it. A snapshot
   * preprocessor that calls it passes a declined snapshot through:
   * `snapshot => convertSnapshot(snapshot) ?? snapshot`.
   */
  convertSnapshot: (json: any) => any;
}
