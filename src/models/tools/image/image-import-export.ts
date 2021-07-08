import { createChange, ImageToolChange } from "./image-change";
import { ITileExportOptions } from "../tool-content-info";
import { safeJsonParse } from "../../../utilities/js-utils";

export interface IImageTileImportSpec {
  type: "Image";
  url: string;
}

export const isImageTileImportSpec = (snapshot: any): snapshot is IImageTileImportSpec =>
              (snapshot?.type === "Image") && (snapshot.url != null) && !snapshot.changes;

export const importImageTileSpec = (snapshot: IImageTileImportSpec) => {
  const { url, ...others } = snapshot;
  return { changes: [createChange(url)], ...others };
};

export const transformCurriculumImageUrl = (url: string, unitBasePath?: string, filename?: string) => {
  return unitBasePath && filename
          ? `${unitBasePath}/images/${filename}`
          : url;
};

export const exportImageTileSpec = (changes: string[], options?: ITileExportOptions) => {
  let url = "";
  let filename = "";
  changes.forEach(change => {
    const imageChange = safeJsonParse<ImageToolChange>(change);
    if (imageChange?.url) {
      url = imageChange.url;
      filename = imageChange.filename || "";
    }
  });
  const transformedUrl = options?.transformImageUrl?.(url, filename) || url;
  return [
    `{`,
    `  "type": "Image",`,
    `  "url": "${transformedUrl}"`,
    `}`
  ].join("\n");
};
