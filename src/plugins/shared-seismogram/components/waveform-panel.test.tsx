import { render } from "@testing-library/react";
import React from "react";
import { DateTime } from "luxon";
import { WaveformPanel } from "./waveform-panel";
import { SharedSeismogram, SharedSeismogramType } from "../shared-seismogram";

// Mock uPlot — canvas won't work in jsdom
jest.mock("uplot", () => {
  return jest.fn().mockImplementation(() => ({
    setData: jest.fn(),
    setSize: jest.fn(),
    destroy: jest.fn(),
  }));
});

// Mock useStores to provide a mock query service
const mockQuery = jest.fn().mockReturnValue({
  level: 1,
  data: [[], [], []],
  amplitudeRange: 0.05,
  isLoading: false,
});
const mockLoadViewport = jest.fn();

jest.mock("../../../hooks/use-stores", () => ({
  useStores: () => ({
    seismicQueryService: {
      query: mockQuery,
      loadViewport: mockLoadViewport,
    },
  }),
}));

const START = DateTime.fromISO("2026-02-01T00:00:00Z");
const END = DateTime.fromISO("2026-02-02T00:00:00Z");

describe("WaveformPanel", () => {
  let sharedSeismogram: SharedSeismogramType;

  beforeEach(() => {
    sharedSeismogram = SharedSeismogram.create();
    sharedSeismogram.setStation("AK", "K204", "", "HNZ");
    mockQuery.mockClear();
    mockLoadViewport.mockClear();
  });

  it("renders the label and container div", () => {
    const { container, getByText } = render(
      <WaveformPanel
        label="1 day"
        sharedSeismogram={sharedSeismogram}
        startTime={START}
        endTime={END}
      />
    );
    expect(getByText("1 day")).toBeInTheDocument();
    expect(container.querySelector(".waveform-panel")).toBeInTheDocument();
    expect(container.querySelector(".waveform-panel-display")).toBeInTheDocument();
  });

  it("does not call query when pixelWidth is 0 (no container size yet)", () => {
    render(
      <WaveformPanel
        label="test"
        sharedSeismogram={sharedSeismogram}
        startTime={START}
        endTime={END}
      />
    );
    // ResizeObserver doesn't fire in jsdom, so pixelWidth stays 0
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
