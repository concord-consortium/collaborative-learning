// The tile registration loads uPlot, which needs browser APIs that jsdom lacks
jest.mock("uplot", () => {
  return jest.fn().mockImplementation(() => ({
    setData: jest.fn(),
    setSize: jest.fn(),
    destroy: jest.fn(),
  }));
});

import { fireEvent, render, screen, within } from "@testing-library/react";
import { DateTime } from "luxon";
import { observer } from "mobx-react-lite";
import React, { useState } from "react";
import { TileModelContext } from "../../../components/tiles/tile-api";
import { addAttributeToDataSet, addCasesToDataSet, DataSet } from "../../../models/data/data-set";
import { SharedDataSet } from "../../../models/shared/shared-data-set";
import { TileModel } from "../../../models/tiles/tile-model";
import { getSharedModelManager } from "../../../models/tiles/tile-environment";
import { SharedSeismogram } from "../../shared-seismogram/shared-seismogram";
import { TimelineContentModel, TimelineContentModelType } from "../models/timeline-content";
import { HiddenEventTypesContext } from "./hidden-event-types-context";
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

  /**
   * Stands in for the tile, which owns the pane's hidden set and decides whether a toggle is
   * saved. `readOnly` means the same here as there: a reader's choice stays in this pane.
   */
  const KeyInAPane = observer(function KeyInAPane(
    { content, readOnly }: { content: TimelineContentModelType, readOnly: boolean }
  ) {
    const [readerHidden, setReaderHidden] = useState<string[]>(() => Array.from(content.hiddenEventTypes));
    const toggle = (eventType: string) => {
      if (readOnly) {
        setReaderHidden(hidden => hidden.includes(eventType)
          ? hidden.filter(t => t !== eventType) : [...hidden, eventType]);
      } else {
        content.toggleEventType(eventType);
      }
    };
    const types = readOnly ? readerHidden : Array.from(content.hiddenEventTypes);
    return (
      <HiddenEventTypesContext.Provider value={{ types, toggle }}>
        <TimelineKey />
      </HiddenEventTypesContext.Provider>
    );
  });

  function renderKey(readOnly = false, content = TimelineContentModel.create()) {
    content.setViewRange(dataStart, dataEnd);
    const model = TileModel.create({ content });
    const result = render(
      <TileModelContext.Provider value={model}>
        <KeyInAPane content={content} readOnly={readOnly} />
      </TileModelContext.Provider>
    );
    return { content, ...result };
  }

  /** One model shown in two panes at once, as My Work does beside the workspace. */
  function renderTwoPanes() {
    const content = TimelineContentModel.create();
    content.setViewRange(dataStart, dataEnd);
    const model = TileModel.create({ content });
    render(
      <TileModelContext.Provider value={model}>
        <div data-testid="workspace"><KeyInAPane content={content} readOnly={false} /></div>
        <div data-testid="my-work"><KeyInAPane content={content} readOnly={true} /></div>
      </TileModelContext.Provider>
    );
    const boxIn = (pane: string, label: string) =>
      within(screen.getByTestId(pane)).getByRole("checkbox", { name: label });
    return { content, boxIn };
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
    expect(content.hiddenEventTypes.slice()).toEqual(["Earthquake"]);
    expect(screen.getByRole("checkbox", { name: "Earthquake" })).not.toBeChecked();
  });

  it("shows it again when the checkbox is checked", () => {
    const { content } = renderKey();
    const box = screen.getByRole("checkbox", { name: "Earthquake" });
    fireEvent.click(box);
    fireEvent.click(box);
    expect(content.hiddenEventTypes.slice()).toEqual([]);
  });

  it("reflects a type hidden before it mounted", () => {
    const content = TimelineContentModel.create();
    content.toggleEventType("Earthquake");
    renderKey(false, content);
    expect(screen.getByRole("checkbox", { name: "Earthquake" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Noise" })).toBeChecked();
  });

  // A reader still needs to narrow what they are looking at, so the key works in a read-only pane.
  // What it must not do there is change the document.
  it("lets a reader switch a type off without touching the saved document", () => {
    const { content } = renderKey(true);
    fireEvent.click(screen.getByRole("checkbox", { name: "Earthquake" }));

    expect(screen.getByRole("checkbox", { name: "Earthquake" })).not.toBeChecked();
    expect(content.hiddenEventTypes.slice()).toEqual([]);
  });

  it("starts a reader's filtering from what the document saved", () => {
    const content = TimelineContentModel.create();
    content.toggleEventType("Earthquake");
    renderKey(true, content);

    expect(screen.getByRole("checkbox", { name: "Earthquake" })).not.toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: "Earthquake" }));
    expect(screen.getByRole("checkbox", { name: "Earthquake" })).toBeChecked();
    // The document still has it hidden; only this reader's view changed.
    expect(content.hiddenEventTypes.slice()).toEqual(["Earthquake"]);
  });

  // The case hidden-event-types-context exists for: My Work renders a student's own document
  // read-only beside the editable workspace, both on one model.
  it("keeps a reader's filtering out of an editable pane showing the same model", () => {
    const { content, boxIn } = renderTwoPanes();

    fireEvent.click(boxIn("my-work", "Earthquake"));

    expect(boxIn("my-work", "Earthquake")).not.toBeChecked();
    expect(boxIn("workspace", "Earthquake")).toBeChecked();
    expect(content.hiddenEventTypes.slice()).toEqual([]);
  });

  // The editable Key must stay in step with itself: its checkbox has to reflect what it writes,
  // even once the other pane's reader has filtered something.
  it("switches a type off in the editable pane and saves it", () => {
    const { content, boxIn } = renderTwoPanes();

    fireEvent.click(boxIn("my-work", "Earthquake"));
    fireEvent.click(boxIn("workspace", "Earthquake"));

    expect(boxIn("workspace", "Earthquake")).not.toBeChecked();
    expect(content.hiddenEventTypes.slice()).toEqual(["Earthquake"]);
  });

  it("carries each type's icon, haloed for the dark checkbox", () => {
    const { container } = renderKey();
    expect(container.querySelectorAll(".event-shape.on-dark")).toHaveLength(2);
  });
});
