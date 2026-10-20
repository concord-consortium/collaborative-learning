jest.mock("uplot", () => jest.fn().mockImplementation(() => ({
  setData: jest.fn(), setSize: jest.fn(), destroy: jest.fn()
})));

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "mobx-react";
import { getRoot, unprotect } from "mobx-state-tree";

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

  it("renders no native datetime inputs", () => {
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
  // the closed control's text, not just the open list's checkmark.
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

  // The accessible name must contain both the field's purpose and its chosen value - see
  // custom-select.tsx for how aria-labelledby concatenates the two, and data-setup.tsx for why
  // `title` alone cannot carry the value. Each half is its own assertion so either going missing
  // fails this test.
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

  // A native <select>'s option popup is OS chrome and cannot be styled, which is why Station and
  // Model are CustomSelect instead - the same reason the date picker's own month chooser (see
  // date-field.tsx) is a CustomSelect too, not a native <select>.
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

  // A start date after today can still arrive from a saved or authored document. Handed straight
  // to the end field as its minimum, it would sit above that field's maximum (today), and React
  // Aria's calendar never finishes rendering with contradictory bounds.
  it("opens the end picker when a saved start date is after today", () => {
    const content = defaultWaveRunnerContent();
    content.setStartDate("2026-10-20");
    content.setEndDate("2026-10-25");
    renderSetup(content);

    fireEvent.click(screen.getAllByRole("button", { name: /Choose date/ })[1]);
    expect(screen.getByRole("button", { name: /October 6, 2026/ }))
      .not.toHaveAttribute("aria-disabled", "true");
  });
});

describe("DataSetup while loading data", () => {
  it("disables both dropdowns", () => {
    const content = defaultWaveRunnerContent();
    // isLoadingData is volatile with no setter of its own; see status-and-output.test.tsx.
    unprotect(getRoot(content));
    content.isLoadingData = true;
    const { container } = renderSetup(content);

    expect(container.querySelector('[data-testid="wave-runner-station-header"]')).toHaveClass("disabled");
    expect(container.querySelector('[data-testid="wave-runner-model-header"]')).toHaveClass("disabled");
  });
});
