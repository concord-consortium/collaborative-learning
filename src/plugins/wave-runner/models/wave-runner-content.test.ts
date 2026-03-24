import { WaveRunnerContentModel } from "./wave-runner-content";

describe("WaveRunnerContent", () => {
  it("is always user resizable", () => {
    const content = WaveRunnerContentModel.create();
    expect(content.isUserResizable).toBe(true);
  });

  it("has default start and end dates covering the mock data range", () => {
    const content = WaveRunnerContentModel.create();
    expect(content.startDate).toBe("2026-01-30");
    expect(content.endDate).toBe("2026-02-06");
  });

  it("allows setting start and end dates", () => {
    const content = WaveRunnerContentModel.create();
    content.setStartDate("2026-02-01");
    content.setEndDate("2026-02-03");
    expect(content.startDate).toBe("2026-02-01");
    expect(content.endDate).toBe("2026-02-03");
  });

  it("starts with no station", () => {
    const content = WaveRunnerContentModel.create();
    expect(content.station).toBeUndefined();
  });

  it("allows setting a station via snapshot", () => {
    const content = WaveRunnerContentModel.create();
    content.setStation({
      network: "AK", station: "K204", location: "", channel: "HNZ", label: "Anchorage Airport"
    });
    expect(content.station?.network).toBe("AK");
    expect(content.station?.station).toBe("K204");
    expect(content.station?.channel).toBe("HNZ");
    expect(content.station?.label).toBe("Anchorage Airport");
  });

  it("replaces station when setStation is called again", () => {
    const content = WaveRunnerContentModel.create();
    content.setStation({
      network: "AK", station: "K204", location: "", channel: "HNZ", label: "Anchorage Airport"
    });
    content.setStation({
      network: "AK", station: "DDM", location: "01", channel: "HNZ", label: "Dexter Display Mine"
    });
    expect(content.station?.station).toBe("DDM");
    expect(content.station?.location).toBe("01");
  });
});
