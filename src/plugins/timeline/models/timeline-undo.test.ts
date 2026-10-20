import { DateTime } from "luxon";
import { Instance } from "mobx-state-tree";
import { createDocumentModel } from "../../../models/document/document";
import { ProblemDocument } from "../../../models/document/document-types";
import { TreeManager } from "../../../models/history/tree-manager";
import { expectEntryToBeComplete } from "../../../models/history/undo-store-test-utils";
import { TimelineContentModelType } from "./timeline-content";

import "../timeline-registration";

// The tile's component draws its graph with uPlot, which needs browser APIs jsdom lacks
jest.mock("../components/timeline-tile", () => ({ TimelineComponent: () => null }));

jest.mock("../../../models/document/log-document-event", () => ({
  logDocumentEvent: jest.fn()
}));

describe("Timeline view preview history", () => {
  const day = (n: number) => DateTime.fromISO("2026-02-01T00:00:00.000Z").plus({ hours: n * 24 });

  it("undoes a previewed gesture, and the fields it saved, in a single step", async () => {
    const document = createDocumentModel({
      type: ProblemDocument, uid: "1", key: "test", createdAt: 1, content: {}, visibility: "public"
    });
    const tileId = document.addTile("Timeline")!.tileId;
    const content = document.content!.getTile(tileId)!.content as TimelineContentModelType;
    content.setViewRange(day(1), day(2));
    document.treeMonitor!.enableMonitoring();
    const manager = document.treeManagerAPI as Instance<typeof TreeManager>;

    content.beginViewPreview();
    content.setViewRange(day(1.5), day(2.5));
    content.setViewRange(day(2), day(3));
    content.endViewPreview();
    await expectEntryToBeComplete(manager, 1);
    expect(content.viewStartTimeISO).toBe(day(2).toISO());
    expect(content.viewEndTimeISO).toBe(day(3).toISO());

    document.undoLastAction();
    await expectEntryToBeComplete(manager, 2);
    expect(content.viewStartTimeISO).toBe(day(1).toISO());
    expect(content.viewEndTimeISO).toBe(day(2).toISO());
  });
});
