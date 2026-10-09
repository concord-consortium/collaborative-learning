// The tile registration loads uPlot, which needs browser APIs that jsdom lacks
jest.mock("uplot", () => {
  return jest.fn().mockImplementation(() => ({
    setData: jest.fn(),
    setSize: jest.fn(),
    destroy: jest.fn(),
  }));
});

import { render } from "@testing-library/react";
import { DateTime } from "luxon";
import React from "react";
import { TileModelContext } from "../../../components/tiles/tile-api";
import { addAttributeToDataSet, addCasesToDataSet, DataSet } from "../../../models/data/data-set";
import { SharedDataSet } from "../../../models/shared/shared-data-set";
import { TileModel } from "../../../models/tiles/tile-model";
import { getSharedModelManager } from "../../../models/tiles/tile-environment";
import { SharedSeismogram } from "../../shared-seismogram/shared-seismogram";
import { TimelineContentModel } from "../models/timeline-content";
import { EventOverlay } from "./event-overlay";

// The timeline tile needs to be registered so TileModel.create
// knows it is a supported tile type
import "../timeline-registration";

jest.mock("../../../models/tiles/tile-environment", () => ({
  ...jest.requireActual("../../../models/tiles/tile-environment"),
  getSharedModelManager: jest.fn()
}));

const mockedGetSharedModelManager = getSharedModelManager as jest.MockedFunction<typeof getSharedModelManager>;

describe("EventOverlay", () => {
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

  function renderOverlay() {
    const content = TimelineContentModel.create();
    content.setViewRange(dataStart, dataEnd);
    const model = TileModel.create({ content });
    return render(
      <TileModelContext.Provider value={model}>
        <EventOverlay />
      </TileModelContext.Provider>
    );
  }

  it("labels each event with its number and its type's shape, centered on the event", () => {
    const { container } = renderOverlay();
    const buttons = container.querySelectorAll<HTMLElement>(".event-label-button");
    const shapes = container.querySelectorAll<HTMLElement>(".event-label-shape");
    expect(buttons).toHaveLength(2);
    expect(shapes).toHaveLength(2);
    expect(buttons[1]).toHaveTextContent("2");
    expect(shapes[1].style.left).toBe("62.5%");
    expect(shapes[0].querySelector(".event-shape")).toHaveClass("blue-event");
    expect(shapes[1].querySelector(".event-shape")).toHaveClass("orange-event");
  });

  it("keeps the event labels out of the Tab order", () => {
    const { container } = renderOverlay();
    container.querySelectorAll(".event-label-button").forEach(button => {
      expect(button).toHaveAttribute("tabindex", "-1");
    });
  });
});
