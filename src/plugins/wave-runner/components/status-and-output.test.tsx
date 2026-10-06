jest.mock("uplot", () => jest.fn().mockImplementation(() => ({
  setData: jest.fn(), setSize: jest.fn(), destroy: jest.fn()
})));

import React from "react";
import { render } from "@testing-library/react";
import { Provider } from "mobx-react";

import { specStores } from "../../../models/stores/spec-stores";
import { TileModel } from "../../../models/tiles/tile-model";
import { TileModelContext } from "../../../components/tiles/tile-api";
import { defaultWaveRunnerContent, WaveRunnerContentModel, WaveRunnerContentModelType }
  from "../models/wave-runner-content";
import { StatusAndOutput } from "./status-and-output";

import "../wave-runner-registration";

function renderStatus(content: WaveRunnerContentModelType) {
  const model = TileModel.create({ content });
  const { container } = render(
    <Provider stores={specStores()}>
      <TileModelContext.Provider value={model}>
        <StatusAndOutput />
      </TileModelContext.Provider>
    </Provider>
  );
  return container.querySelector(".waveform-container");
}

// The graph space is always a rectangle; only its fill changes. Collapsing it when empty left a
// hole in the panel.
describe("StatusAndOutput graph area", () => {
  it("stays grey until a station and a model are both chosen", () => {
    expect(renderStatus(defaultWaveRunnerContent())).not.toHaveClass("configured");
  });

  it("stays grey with a station but no model", () => {
    const content = defaultWaveRunnerContent();
    content.setStation({ network: "AK", station: "K204", location: "", channel: "HNZ", label: "Anchorage" });
    expect(renderStatus(content)).not.toHaveClass("configured");
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
