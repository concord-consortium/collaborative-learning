import { render } from "@testing-library/react";
import React from "react";
import { DateTime } from "luxon";
import { WaveformPanel } from "../../shared-seismogram/components/waveform-panel";
import type { seismogram as SeismogramNS } from "seisplotjs";
type Seismogram = SeismogramNS.Seismogram;

// Mock seisplotjs — the Seismograph custom element won't work in jsdom
jest.mock("seisplotjs", () => ({
  seismograph: {
    Seismograph: jest.fn().mockImplementation(() => document.createElement("div")),
  },
  seismographconfig: {
    SeismographConfig: jest.fn().mockImplementation(() => ({})),
  },
  seismogram: {
    SeismogramDisplayData: {
      fromSeismogram: jest.fn().mockReturnValue({
        timeRange: null,
      }),
    },
  },
}));

const START = DateTime.fromISO("2026-02-01T00:00:00Z");

describe.skip("WaveformPanel", () => {
  const mockSeismogram = {} as Seismogram;

  it("renders the label and container div", () => {
    const { container, getByText } = render(
      <WaveformPanel
        label="1 hour"
        startTime={START}
        durationSeconds={3600}
        seismogram={mockSeismogram}
      />
    );
    expect(getByText("1 hour")).toBeInTheDocument();
    expect(container.querySelector(".waveform-panel")).toBeInTheDocument();
    expect(container.querySelector(".waveform-panel-display")).toBeInTheDocument();
  });
});
