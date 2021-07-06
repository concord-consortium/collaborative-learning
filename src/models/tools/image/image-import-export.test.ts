import { safeJsonParse } from "../../../utilities/js-utils";
import { ITileExportOptions } from "../tool-content-info";
import { ImageToolChange } from "./image-change";
import {
  exportImageTileSpec, IImageTileImportSpec, importImageTileSpec, isImageTileImportSpec, transformCurriculumImageUrl
} from "./image-import-export";

const isImageToolChangeArray = (changes: ImageToolChange[] | string[]): changes is ImageToolChange[] =>
        (changes.length > 0) && (typeof changes[0] === "object");

const exportImageToolJson = (changes: ImageToolChange[] | string[], options?: ITileExportOptions) => {
  const changesJson = isImageToolChangeArray(changes)
                        ? changes.map(change => JSON.stringify(change))
                        : changes;
  const exportJson = exportImageTileSpec(changesJson, options);
  // console.log("exportJson:", exportJson);
  const exportJs = safeJsonParse(exportJson);
  // log the JSON on error for debugging
  // !exportJs && console.log("JSON PARSE ERROR\n----------------\n", exportJson);
  return exportJs;
};

describe("isImageTileImportSpec", () => {
  it("should work as expected", () => {
    expect(isImageTileImportSpec(null)).toBe(false);
    expect(isImageTileImportSpec({})).toBe(false);
    expect(isImageTileImportSpec({ type: "Image" })).toBe(false);
    expect(isImageTileImportSpec({ type: "Image", url: "foo" })).toBe(true);
    expect(isImageTileImportSpec({ type: "Image", url: "foo", changes: [] })).toBe(false);
  });
});

describe("Image import", () => {
  it("should import correctly", () => {
    const input = {
      type: "Image" as const,
      url: "my/image/url"
    };
    const result = importImageTileSpec(input);
    expect(result.type).toBe("Image");
    expect(result.changes.length).toBe(1);
    expect(safeJsonParse<IImageTileImportSpec>(result.changes[0]))
            .toEqual({ operation: "update", url: "my/image/url" });
  });
});

describe("Image export with default options", () => {
  it("should export empty changes", () => {
    const changes: ImageToolChange[] = [];
    expect(exportImageToolJson(changes))
            .toEqual({ type: "Image", url: "" });
  });

  it("should ignore invalid changes", () => {
    const changes: string[] = [
      "{ INVALID }"
    ];
    expect(exportImageToolJson(changes))
            .toEqual({ type: "Image", url: "" });
  });

  it("should ignore incomplete changes", () => {
    const changes: ImageToolChange[] = [
      { operation: "update" } as any
    ];
    expect(exportImageToolJson(changes))
            .toEqual({ type: "Image", url: "" });
  });

  it("should export tiles created without filename", () => {
    const changes: ImageToolChange[] = [
      { operation: "update", url: "my/img/url" }
    ];
    expect(exportImageToolJson(changes))
            .toEqual({ type: "Image", url: "my/img/url" });
  });

  it("should export tiles created with filename", () => {
    const changes: ImageToolChange[] = [
      { operation: "update", url: "my/img/url", filename: "my/filename" }
    ];
    expect(exportImageToolJson(changes))
            .toEqual({ type: "Image", url: "my/img/url" });
  });

  it("should export updated tiles", () => {
    const changes: ImageToolChange[] = [
      { operation: "update", url: "my/img/url" },
      { operation: "update", url: "my/updated/img/url" }
    ];
    expect(exportImageToolJson(changes))
            .toEqual({ type: "Image", url: "my/updated/img/url" });
  });

  it("should export updated tiles with filenames", () => {
    const changes: ImageToolChange[] = [
      { operation: "update", url: "my/img/url" },
      { operation: "update", url: "my/updated/img/url", filename: "my/updated/filename" }
    ];
    expect(exportImageToolJson(changes))
            .toEqual({ type: "Image", url: "my/updated/img/url" });
  });

  it("should export updated tiles with filenames", () => {
    const changes: ImageToolChange[] = [
      { operation: "update", url: "my/img/url" },
      { operation: "update", url: "my/updated/img/url", filename: "my/updated/filename" },
      { operation: "update", url: "my/final/url" }
    ];
    expect(exportImageToolJson(changes))
            .toEqual({ type: "Image", url: "my/final/url" });
  });
});

describe('Image export with transformUrl option', () => {
  const unitBasePath = "curriculum";

  const transformImageUrl = (url: string, filename?: string) => {
    return transformCurriculumImageUrl(url, unitBasePath, filename);
  };

  it("should export tiles created without filename", () => {
    const changes: ImageToolChange[] = [
      { operation: "update", url: "my/img/url" }
    ];
    expect(exportImageToolJson(changes, { transformImageUrl }))
            .toEqual({ type: "Image", url: "my/img/url" });
  });

  it("should export tiles created with filename", () => {
    const changes: ImageToolChange[] = [
      { operation: "update", url: "my/img/url", filename: "my/filename" }
    ];
    expect(exportImageToolJson(changes, { transformImageUrl }))
            .toEqual({ type: "Image", url: "curriculum/images/my/filename" });
  });

});
