import { StationModel, stationId } from "./station-model";

describe("StationModel", () => {
  it("creates a station with all fields", () => {
    const station = StationModel.create({
      network: "AK", station: "K204", location: "", channel: "HNZ", label: "Anchorage Airport"
    });
    expect(station.network).toBe("AK");
    expect(station.station).toBe("K204");
    expect(station.location).toBe("");
    expect(station.channel).toBe("HNZ");
    expect(station.label).toBe("Anchorage Airport");
  });

  it("defaults location to empty string", () => {
    const station = StationModel.create({
      network: "AK", station: "K204", channel: "HNZ", label: "Anchorage Airport"
    });
    expect(station.location).toBe("");
  });

  it("computes id with empty location as double underscore", () => {
    const station = StationModel.create({
      network: "AK", station: "K204", channel: "HNZ", label: "Anchorage Airport"
    });
    expect(station.id).toBe("AK_K204___HNZ");
  });

  it("computes id with non-empty location", () => {
    const station = StationModel.create({
      network: "AK", station: "DDM", location: "01", channel: "HNZ", label: "Dexter Display Mine"
    });
    expect(station.id).toBe("AK_DDM_01_HNZ");
  });
});

describe("stationId", () => {
  it("computes id from a plain object (snapshot)", () => {
    expect(stationId({ network: "AK", station: "K204", location: "", channel: "HNZ" }))
      .toBe("AK_K204___HNZ");
  });

  it("computes id when location is undefined", () => {
    expect(stationId({ network: "AK", station: "K204", channel: "HNZ" }))
      .toBe("AK_K204___HNZ");
  });
});
