jest.mock("uplot", () => jest.fn().mockImplementation(() => ({
  setData: jest.fn(), setSize: jest.fn(), destroy: jest.fn()
})));

import React from "react";
import { render, screen } from "@testing-library/react";
import { Provider } from "mobx-react";
import { getRoot, Instance, unprotect } from "mobx-state-tree";

import { specStores } from "../../../models/stores/spec-stores";
import { TileModel } from "../../../models/tiles/tile-model";
import { TileModelContext } from "../../../components/tiles/tile-api";
import { DocumentContentModel } from "../../../models/document/document-content";
import { createDocumentModel } from "../../../models/document/document";
import { ProblemDocument } from "../../../models/document/document-types";
import { defaultWaveRunnerContent, WaveRunnerContentModel, WaveRunnerContentModelType }
  from "../models/wave-runner-content";
import { kWaveRunnerTileType } from "../wave-runner-types";
import { StatusAndOutput } from "./status-and-output";

import "../../../models/shared/shared-data-set-registration";
import "../../shared-seismogram/shared-seismogram-registration";
import "../wave-runner-registration";

function renderStatusForModel(model: Instance<typeof TileModel>) {
  const { container } = render(
    <Provider stores={specStores()}>
      <TileModelContext.Provider value={model}>
        <StatusAndOutput />
      </TileModelContext.Provider>
    </Provider>
  );
  return container.querySelector(".waveform-container");
}

function renderStatus(content: WaveRunnerContentModelType) {
  return renderStatusForModel(TileModel.create({ content }));
}

// The graph space is always a rectangle; only its fill changes. Collapsing it when empty left a
// hole in the panel.
describe("StatusAndOutput graph area", () => {
  it("stays gray until a station and a model are both chosen", () => {
    expect(renderStatus(defaultWaveRunnerContent())).not.toHaveClass("configured");
  });

  it("stays gray with a station but no model", () => {
    const content = defaultWaveRunnerContent();
    content.setStation({ network: "AK", station: "K204", location: "", channel: "HNZ", label: "Anchorage" });
    expect(renderStatus(content)).not.toHaveClass("configured");
  });

  it("tells the student what to do before anything is set up", () => {
    renderStatus(defaultWaveRunnerContent());
    expect(screen.getByText("Set up data then run the model.")).toBeInTheDocument();
  });

  it("turns black once both are chosen", () => {
    // selectedModelUrl has no setter of its own - it is assigned while loading metadata - so the
    // chosen state is built from a snapshot.
    const content = WaveRunnerContentModel.create({
      station: { network: "AK", station: "K204", location: "", channel: "HNZ", label: "Anchorage" },
      selectedModelUrl: "https://models.example.com/v1/compact/metadata.json"
    });
    expect(renderStatus(content)).toHaveClass("configured");
  });
});

// The status line shows exactly one message, chosen by priority: error > loading > running >
// complete > configured > setup (see status-and-output.tsx). Only the lowest-priority case (the
// setup message above) had a test before this; an error failing to outrank an in-progress run was
// a real bug on this branch (fixed in wave-runner-content.ts's cross-clearing of loadDataError and
// runError), so that ordering gets its own tests here too.
describe("StatusAndOutput status line priority", () => {
  const station = { network: "AK", station: "K204", location: "", channel: "HNZ", label: "Anchorage" };
  const modelUrl = "https://models.example.com/v1/compact/metadata.json";

  function configuredContent() {
    return WaveRunnerContentModel.create({ station, selectedModelUrl: modelUrl });
  }

  // eventsDataSet is built through the shared model manager, which a bare
  // WaveRunnerContentModel.create() (every other helper here) never wires up - it only works once
  // the content is part of a real document tree, the same way setupTileInDocument does in
  // wave-runner-content.test.ts. Returns the tile model (not just the content) so the caller can
  // render it directly rather than re-wrapping the content in a second, competing tree.
  function tileWithCompletedRun() {
    const docContent = DocumentContentModel.create({
      tileMap: { tile1: { id: "tile1", content: { type: kWaveRunnerTileType } } }
    });
    const docModel = createDocumentModel({ uid: "1", type: ProblemDocument, key: "test", content: docContent as any });
    docModel.treeMonitor!.enableMonitoring();
    const tile = docContent.tileMap.get("tile1")!;
    const content = tile.content as WaveRunnerContentModelType;
    content.setStation(station);
    content.getOrCreateEventsDataSet();
    return tile;
  }

  // Volatile progress/error state has no setter action of its own - it is normally reached only
  // from inside loadEnvelopeData/runModel - so it is set directly here (unprotect bypasses MST's
  // action-only guard) purely to drive the display logic through every branch of its priority
  // chain, independent of whether the model's own actions can produce that exact combination.
  // unprotect only works on a tree's root, which content stops being once it is embedded in a
  // document (see tileWithCompletedRun), so this unprotects the whole tree rather than the node.
  function withVolatileState(content: WaveRunnerContentModelType, state: Partial<WaveRunnerContentModelType>) {
    unprotect(getRoot(content));
    Object.assign(content, state);
    return content;
  }

  it("shows loading progress while envelope data is loading", () => {
    const content = withVolatileState(configuredContent(),
      { isLoadingData: true, loadDaysDone: 1, loadDaysTotal: 4 });
    renderStatus(content);
    expect(screen.getByText("Loading data: day 2 of 4...")).toBeInTheDocument();
  });

  it("shows run progress while the model is running", () => {
    const content = withVolatileState(configuredContent(),
      { isRunning: true, chunksProcessed: 2, chunksTotal: 5 });
    renderStatus(content);
    expect(screen.getByText("Processing day 3 of 5...")).toBeInTheDocument();
  });

  it("shows a completion message once events are available", () => {
    renderStatusForModel(tileWithCompletedRun());
    expect(screen.getByText("Run complete.")).toBeInTheDocument();
  });

  it("invites a run once station and model are both chosen but nothing has run yet", () => {
    renderStatus(configuredContent());
    expect(screen.getByText("Ready to run the model.")).toBeInTheDocument();
  });

  it("puts an error ahead of loading progress", () => {
    const content = withVolatileState(configuredContent(),
      { isLoadingData: true, loadDaysDone: 1, loadDaysTotal: 4, loadDataError: "Error loading data: offline" });
    renderStatus(content);
    expect(screen.getByText("Error loading data: offline")).toBeInTheDocument();
    expect(screen.queryByText(/Loading data: day/)).not.toBeInTheDocument();
  });

  // The real bug this guards against: a run's own error must win even over its own in-progress
  // counters and over a dataset left from an earlier completed run - error is first, full stop.
  it("puts an error ahead of run progress and a completed run", () => {
    const tile = tileWithCompletedRun();
    withVolatileState(tile.content as WaveRunnerContentModelType,
      { isRunning: true, chunksProcessed: 1, chunksTotal: 2, runError: "Error running model: boom" });
    renderStatusForModel(tile);
    expect(screen.getByText("Error running model: boom")).toBeInTheDocument();
    expect(screen.queryByText(/Processing day/)).not.toBeInTheDocument();
    expect(screen.queryByText("Run complete.")).not.toBeInTheDocument();
  });

  it("prefers loadDataError over runError when both happen to be set", () => {
    const content = withVolatileState(configuredContent(),
      { loadDataError: "Error loading data: offline", runError: "Error running model: boom" });
    renderStatus(content);
    expect(screen.getByText("Error loading data: offline")).toBeInTheDocument();
  });
});
