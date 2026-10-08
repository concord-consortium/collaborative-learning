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
  // Pinned so the bounds assertions do not depend on the day the suite happens to run.
  beforeEach(() => jest.useFakeTimers().setSystemTime(new Date("2026-10-06T12:00:00Z")));
  afterEach(() => jest.useRealTimers());

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

  // Dates sit in September so they stay in the past relative to the pinned clock; a day after
  // today is disabled whatever the other field says.
  it("bounds the end picker by the start date", () => {
    const content = defaultWaveRunnerContent();
    content.setStartDate("2026-09-10");
    content.setEndDate("2026-09-20");
    renderSetup(content);

    fireEvent.click(screen.getAllByRole("button", { name: /Choose date/ })[1]);
    expect(screen.getByRole("button", { name: /September 5, 2026/ }))
      .toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: /September 25, 2026/ }))
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

  // Guards the placeholder-masking bug described in data-setup.tsx: picking a station must update
  // the closed control's text, not just the open list's tick.
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

  // The control's accessible name is composed via aria-labelledby from the visible <label> (the
  // field's purpose) plus the header's own text (its current value) - see custom-select.tsx. An
  // accessible name of just "Station" (the old aria-label regression) or just "Dexter Display
  // Mine" (falling back to `title`, which this tile supplies only while nothing is selected) would
  // each fail only one of these two assertions, so both must hold for the fix to be proven.
  it("keeps both the purpose and the chosen value in the station dropdown's accessible name", () => {
    renderSetup();
    fireEvent.click(screen.getByText("Dexter Display Mine"));
    const header = screen.getByRole("button", { name: /Station/ });
    expect(header).toHaveAccessibleName(/Station/);
    expect(header).toHaveAccessibleName(/Dexter Display Mine/);
  });

  // Same bug, same fix, for the model dropdown. The only configured model is auto-selected on
  // mount, so its text already appears in both the closed control and the (hidden but present)
  // list option - scope the click to the list so it is unambiguous.
  it("keeps both the purpose and the chosen value in the model dropdown's accessible name", () => {
    const { container } = renderSetup();
    const option = container.querySelector('[data-testid="wave-runner-model-list"] .list-item')!;
    fireEvent.click(option);
    const header = screen.getByRole("button", { name: /Model/ });
    expect(header).toHaveAccessibleName(/Model/);
    expect(header).toHaveAccessibleName(/Compact Model/);
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

describe("DataSetup future dates", () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(new Date("2026-10-06T12:00:00Z")));
  afterEach(() => jest.useRealTimers());

  it("does not offer a day after today", () => {
    const content = defaultWaveRunnerContent();
    content.setStartDate("2026-10-01");
    content.setEndDate("2026-10-05");
    renderSetup(content);

    fireEvent.click(screen.getAllByRole("button", { name: /Choose date/ })[1]);
    expect(screen.getByRole("button", { name: /October 7, 2026/ }))
      .toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: /October 6, 2026/ }))
      .not.toHaveAttribute("aria-disabled", "true");
  });
});
