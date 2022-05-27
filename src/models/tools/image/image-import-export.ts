import { safeJsonParse } from "../../../utilities/js-utils";
import { ITileExportOptions } from "../tool-content-info";

export interface ILegacyImageTileImport {
  type: "Image";
  url: string;
  changes: string[];
}

export const isLegacyImageTileImport = (snapshot: any): snapshot is ILegacyImageTileImport => {
  return (snapshot?.type === "Image") && snapshot.changes;
};

export const convertImageTile = (snapshot: ILegacyImageTileImport) => {
  const { changes, url, ...others } = snapshot;
  let changeUrl = "";
  if (snapshot.changes.length > 0) {
    const changeObj = safeJsonParse(snapshot.changes[changes.length-1]);
    changeUrl = changeObj.url;
  }
  return ({url: changeUrl, ...others});

};

export const transformCurriculumImageUrl = (url?: string, unitBasePath?: string, filename?: string) => {
  return unitBasePath && filename
          ? `${unitBasePath}/images/${filename}`
          : url ? url : "";
};

export const exportImageTileSpec = (url?: string, filename?: string, options?: ITileExportOptions) => {
  const transformedUrl = url && options?.transformImageUrl?.(url, filename) || url;
  return [
    `{`,
    `  "type": "Image",`,
    `  "url": "${transformedUrl}"`,
    `}`
  ].join("\n");
};
