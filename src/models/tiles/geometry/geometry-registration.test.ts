import { tileSnapshotPreProcessor } from "./geometry-registration";

describe("tileSnapshotPreProcessor", () => {
  it("moves title from content to tile", () => {
    const title = "title";
    const snapWithNoTitle = { content: {} };
    const snapWithTileTitle = { title, content: {} };
    const snapWithContentTitle = { content: { title } };
    expect(tileSnapshotPreProcessor(snapWithNoTitle)).toEqual(snapWithNoTitle);
    expect(tileSnapshotPreProcessor(snapWithTileTitle)).toEqual(snapWithTileTitle);
    expect(tileSnapshotPreProcessor(snapWithContentTitle)).toEqual({ content: { title }, title });
  });
});
