import { safeJsonParse } from "../../../utilities/js-utils";
import { ITileExportOptions } from "../tile-content-info";

export interface ILegacyImageTileImport {
  type: "Image";
  url: string;
  changes: string[];
}

export const isLegacyImageTileImport = (snapshot: any): snapshot is ILegacyImageTileImport => {
  return (snapshot?.type === "Image") && !!snapshot.changes;
};

export const convertLegacyImageTile = (snapshot: ILegacyImageTileImport) => {
  const { changes, url, ...others } = snapshot;
  let changeUrl = "", changeFilename = "";
  if (snapshot.changes.length > 0) {
    const changeObj = safeJsonParse(snapshot.changes[changes.length-1]);
    changeUrl = changeObj.url;
    changeFilename = changeObj.filename;
  }
  return ({ url: changeUrl, fileName: changeFilename, ...others });

};

export const transformCurriculumImageUrl = (url?: string, unitBasePath?: string, filename?: string) => {
  return unitBasePath && filename
          ? `${unitBasePath}/images/${filename}`
          : url || "";
};

export const exportImageTileSpec = (url?: string, filename?: string, options?: ITileExportOptions) => {
  const transformedUrl = url && options?.transformImageUrl?.(url, filename) || url;
  if (filename) {
    return [
      `{`,
      `  "type": "Image",`,
      `  "url": "${transformedUrl}",`,
      `  "filename": "${transformedUrl}"`,
      `}`
    ].join("\n");
  } else {
    return [
      `{`,
      `  "type": "Image",`,
      `  "url": "${transformedUrl}"`,
      `}`
    ].join("\n");
  }
};
