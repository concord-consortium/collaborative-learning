// The tile registration loads uPlot, which needs browser APIs that jsdom lacks
jest.mock("uplot", () => {
  return jest.fn().mockImplementation(() => ({
    setData: jest.fn(),
    setSize: jest.fn(),
    destroy: jest.fn(),
  }));
});

import { fireEvent, render, screen } from "@testing-library/react";
import { DateTime } from "luxon";
import React from "react";
import { ReadOnlyContext } from "../../../components/document/read-only-context";
import { TileModelContext } from "../../../components/tiles/tile-api";
import { addAttributeToDataSet, addCasesToDataSet, DataSet } from "../../../models/data/data-set";
import { SharedDataSet } from "../../../models/shared/shared-data-set";
import { TileModel } from "../../../models/tiles/tile-model";
import { getSharedModelManager } from "../../../models/tiles/tile-environment";
import { SharedSeismogram } from "../../shared-seismogram/shared-seismogram";
import { TimelineContentModel } from "../models/timeline-content";
import { TimelineKey } from "./timeline-key";

// The timeline tile needs to be registered so TileModel.create
// knows it is a supported tile type
import "../timeline-registration";

jest.mock("../../../models/tiles/tile-environment", () => ({
  ...jest.requireActual("../../../models/tiles/tile-environment"),
  getSharedModelManager: jest.fn()
}));

const mockedGetSharedModelManager = getSharedModelManager as jest.MockedFunction<typeof getSharedModelManager>;

describe("TimelineKey", () => {
  const dataStart = DateTime.fromISO("2026-02-01T00:00:00.000Z");
  const dataEnd = DateTime.fromISO("2026-02-05T00:00:00.000Z");
  const day = (n: number) => dataStart.plus({ hours: n * 24 });

  beforeEach(() => {
    const dataSet = DataSet.create();
    addAttributeToDataSet(dataSet, { name: "windowStart" });
    addAttributeToDataSet(dataSet, { name: "windowEnd" });
    addAttributeToDataSet(dataSet, { name: "eventType" });
    addCasesToDataSet(dataSet, [
      { windowStart: day(1).toISO()!, windowEnd: day(1.5).toISO()!, eventType: "Earthquake" },
      { windowStart: day(2).toISO()!, windowEnd: day(3).toISO()!, eventType: "Noise" }
    ]);
    const sharedDataSet = SharedDataSet.create({ dataSet });
    const sharedSeismogram = {
      station: { network: "AK", station: "K204", location: "", channel: "HNZ" },
      startTime: dataStart,
      endTime: dataEnd,
    };
    mockedGetSharedModelManager.mockReturnValue({
      isReady: true,
      getTileSharedModelsByType: (_self: any, type: any) => {
        if (type === SharedSeismogram) return [sharedSeismogram];
        if (type === SharedDataSet) return [sharedDataSet];
        return [];
      },
    } as any);
  });

  afterEach(() => {
    mockedGetSharedModelManager.mockReset();
  });

  function renderKey(readOnly = false, content = TimelineContentModel.create()) {
    content.setViewRange(dataStart, dataEnd);
    const model = TileModel.create({ content });
    const result = render(
      <ReadOnlyContext.Provider value={readOnly}>
        <TileModelContext.Provider value={model}>
          <TimelineKey />
        </TileModelContext.Provider>
      </ReadOnlyContext.Provider>
    );
    return { content, ...result };
  }

  it("lists one checkbox per event type present, switched on", () => {
    renderKey();
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes).toHaveLength(2);
    boxes.forEach(box => expect(box).toBeChecked());
    expect(screen.getByRole("checkbox", { name: "Earthquake" })).toBeInTheDocument();
  });

  it("hides a type when its checkbox is unchecked", () => {
    const { content } = renderKey();
    fireEvent.click(screen.getByRole("checkbox", { name: "Earthquake" }));
    expect(content.isEventTypeHidden("Earthquake")).toBe(true);
    expect(screen.getByRole("checkbox", { name: "Earthquake" })).not.toBeChecked();
  });

  it("shows it again when the checkbox is checked", () => {
    const { content } = renderKey();
    const box = screen.getByRole("checkbox", { name: "Earthquake" });
    fireEvent.click(box);
    fireEvent.click(box);
    expect(content.isEventTypeHidden("Earthquake")).toBe(false);
  });

  it("reflects a type hidden before it mounted", () => {
    const content = TimelineContentModel.create();
    content.toggleEventType("Earthquake");
    renderKey(false, content);
    expect(screen.getByRole("checkbox", { name: "Earthquake" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Noise" })).toBeChecked();
  });

  // A read-only pane shares the document model, so a live checkbox there edits the student's work.
  it("disables its checkboxes when read-only", () => {
    renderKey(true);
    screen.getAllByRole("checkbox").forEach(box => expect(box).toBeDisabled());
  });

  it("carries each type's icon, haloed for the dark checkbox", () => {
    const { container } = renderKey();
    expect(container.querySelectorAll(".event-shape.on-dark")).toHaveLength(2);
  });
});
