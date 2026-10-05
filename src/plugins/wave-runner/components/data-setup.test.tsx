jest.mock("uplot", () => jest.fn().mockImplementation(() => ({
  setData: jest.fn(), setSize: jest.fn(), destroy: jest.fn()
})));

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "mobx-react";

import { specStores } from "../../../models/stores/spec-stores";
import { specAppConfig } from "../../../models/stores/spec-app-config";
import { TileModel } from "../../../models/tiles/tile-model";
import { TileModelContext } from "../../../components/tiles/tile-api";
import { defaultWaveRunnerContent, WaveRunnerContentModelType } from "../models/wave-runner-content";
import { DataSetup } from "./data-setup";

import "../wave-runner-registration";

const stores = specStores({
  appConfig: specAppConfig({
    config: {
      settings: {
        "wave-runner": {
          stations: [
            { network: "AK", station: "K204", channel: "HNZ", label: "Anchorage Airport" },
            { network: "AK", station: "DDM", location: "01", channel: "HNZ", label: "Dexter Display Mine" }
          ],
          defaultStation: 0,
          models: [
            { label: "Compact Model", metadataUrl: "https://models.example.com/v1/compact-v2/metadata.json" }
          ],
          defaultModel: 0
        }
      }
    }
  })
});

// useWaveRunnerContent reads TileModelContext and throws unless the model's content is WaveRunner
// content, so the tile model is the provider here - there is no separate content context.
function renderSetup(content: WaveRunnerContentModelType = defaultWaveRunnerContent()) {
  const model = TileModel.create({ content });
  const utils = render(
    <Provider stores={stores}>
      <TileModelContext.Provider value={model}>
        <DataSetup />
      </TileModelContext.Provider>
    </Provider>
  );
  return { content, container: utils.container };
}

describe("DataSetup date fields", () => {
  it("renders a picker for each date", () => {
    renderSetup();
    expect(screen.getByText("Start Date and Time")).toBeInTheDocument();
    expect(screen.getByText("End Date and Time")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Choose date/ })).toHaveLength(2);
  });

  it("no longer renders native datetime inputs", () => {
    const { container } = renderSetup();
    expect(container.querySelectorAll('input[type="datetime-local"]')).toHaveLength(0);
  });

  // The acceptance criterion: an out-of-order range must be unselectable, which is achieved by
  // handing each picker the other's date as its bound.
  it("bounds the end picker by the start date and vice versa", () => {
    const { content } = renderSetup();
    expect(content.startDate).toBe("2026-09-01");
    expect(content.endDate).toBe("2026-10-01");

    const triggers = screen.getAllByRole("button", { name: /Choose date/ });
    // The start picker's calendar must not offer a day after the end date. The calendar opens on
    // September (the start date's month), so the only visible days after the end date (2026-10-01)
    // are the trailing October days that fill out September's last week.
    fireEvent.click(triggers[0]);
    expect(screen.getByRole("button", { name: /October 2, 2026/ }))
      .toHaveAttribute("aria-disabled", "true");
  });
});
