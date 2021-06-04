import { createChange, ImageToolChange } from "./image-change";
import { safeJsonParse } from "../../../utilities/js-utils";

export interface IImageTileImportSpec {
  type: "Image";
  url: string;
}

const comma = (condition: boolean) => condition ? "," : "";

export const isImageTileImportSpec = (snapshot: any): snapshot is IImageTileImportSpec =>
              (snapshot?.type === "Image") && (snapshot.url != null) && !snapshot.changes;

export const importImageTileSpec = (snapshot: IImageTileImportSpec) => {
  const { url, ...others } = snapshot;
  return { changes: [createChange(url)], ...others };
};

export interface IExportImageTileOptions {
  transformUrl?: (url: string, filename?: string) => string;
}

export const exportImageTileSpec = (changes: string[], options?: IExportImageTileOptions) => {
  const { transformUrl } = options || {};
  let url = "";
  let filename = "";
  changes.forEach(change => {
    const imageChange = safeJsonParse<ImageToolChange>(change);
    if (imageChange?.url) {
      url = imageChange.url;
      filename = imageChange.filename || "";
    }
  });
  return [
    `{`,
    `  "type": "Image",`,
    `  "url": "${transformUrl?.(url, filename) || url}"${comma(!!filename)}`,
    ...(filename ? [`  "filename": "${filename}"`] : []),
    `}`
  ].join("\n");
};
