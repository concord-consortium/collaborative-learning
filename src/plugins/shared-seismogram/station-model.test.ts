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
    expect(station.id).toBe("AK_K204__HNZ");
  });

  it("computes id with non-empty location", () => {
    const station = StationModel.create({
      network: "AK", station: "DDM", location: "01", channel: "HNZ", label: "Dexter Display Mine"
    });
    expect(station.id).toBe("AK_DDM_01_HNZ");
  });

  describe("equals", () => {
    const base = { network: "AK", station: "K204", location: "", channel: "HNZ", label: "Anchorage Airport" };

    it("returns true for an identical config", () => {
      const station = StationModel.create(base);
      expect(station.equals(base)).toBe(true);
    });

    it("returns true when config omits optional fields that default to empty", () => {
      const station = StationModel.create({ network: "AK", station: "K204", channel: "HNZ" });
      expect(station.equals({ network: "AK", station: "K204", channel: "HNZ" })).toBe(true);
    });

    it("returns false when network differs", () => {
      const station = StationModel.create(base);
      expect(station.equals({ ...base, network: "US" })).toBe(false);
    });

    it("returns false when station differs", () => {
      const station = StationModel.create(base);
      expect(station.equals({ ...base, station: "DDM" })).toBe(false);
    });

    it("returns false when location differs", () => {
      const station = StationModel.create(base);
      expect(station.equals({ ...base, location: "01" })).toBe(false);
    });

    it("returns false when channel differs", () => {
      const station = StationModel.create(base);
      expect(station.equals({ ...base, channel: "BHZ" })).toBe(false);
    });

    it("returns false when label differs", () => {
      const station = StationModel.create(base);
      expect(station.equals({ ...base, label: "Different Label" })).toBe(false);
    });
  });
});

describe("stationId", () => {
  it("computes id from a plain object (snapshot)", () => {
    expect(stationId({ network: "AK", station: "K204", location: "", channel: "HNZ" }))
      .toBe("AK_K204__HNZ");
  });

  it("computes id when location is undefined", () => {
    expect(stationId({ network: "AK", station: "K204", channel: "HNZ" }))
      .toBe("AK_K204__HNZ");
  });
});
