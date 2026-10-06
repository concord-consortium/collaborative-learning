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
  // Both bounds are asserted on days INSIDE the focused month. React Aria disables adjacent-month
  // days regardless of any bound, so a trailing October day would read as disabled even if the
  // bound were never wired at all - such a test would pass against a broken component.
  it("bounds the start picker by the end date", () => {
    const content = defaultWaveRunnerContent();
    content.setEndDate("2026-09-20");
    renderSetup(content);

    fireEvent.click(screen.getAllByRole("button", { name: /Choose date/ })[0]);
    expect(screen.getByRole("button", { name: /September 25, 2026/ }))
      .toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: /September 10, 2026/ }))
      .not.toHaveAttribute("aria-disabled", "true");
  });

  it("bounds the end picker by the start date", () => {
    const content = defaultWaveRunnerContent();
    content.setStartDate("2026-10-10");
    content.setEndDate("2026-10-20");
    renderSetup(content);

    fireEvent.click(screen.getAllByRole("button", { name: /Choose date/ })[1]);
    expect(screen.getByRole("button", { name: /October 5, 2026/ }))
      .toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: /October 25, 2026/ }))
      .not.toHaveAttribute("aria-disabled", "true");
  });
});

describe("DataSetup dropdowns", () => {
  function listLabels(container: HTMLElement, testId: string) {
    return Array.from(container.querySelectorAll(`[data-testid="${testId}-list"] .list-item .item`))
      .map(el => el.textContent);
  }

  it("lists the configured stations", () => {
    const { container } = renderSetup();
    expect(listLabels(container, "wave-runner-station"))
      .toEqual(["Anchorage Airport", "Dexter Display Mine"]);
  });

  // CustomSelect shows `title || selectedItem.text`, so a placeholder passed unconditionally would
  // mask the student's choice: the control would still read "Choose a station" after they picked
  // one, with only the tick inside the open list to show otherwise.
  it("shows the chosen station in the closed control", () => {
    const { container } = renderSetup();
    fireEvent.click(screen.getByText("Dexter Display Mine"));
    expect(container.querySelector('[data-testid="wave-runner-station-header"]'))
      .toHaveTextContent("Dexter Display Mine");
  });

  it("sets the station when one is chosen", () => {
    const { content } = renderSetup();
    fireEvent.click(screen.getByText("Dexter Display Mine"));
    expect(content.station?.station).toBe("DDM");
  });

  it("lists the configured models", () => {
    const { container } = renderSetup();
    expect(listLabels(container, "wave-runner-model")).toEqual(["Compact Model"]);
  });

  // A native <select>'s option popup is OS chrome and cannot be styled, which is the whole reason
  // these moved to the house dropdown. The month-and-year select inside each date picker is a
  // native select and is expected; the station and model dropdowns must not be.
  it("renders no native select for station or model", () => {
    const { container } = renderSetup();
    expect(container.querySelectorAll("select.dropdown")).toHaveLength(0);
  });
});
