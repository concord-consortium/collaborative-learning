import { coverageSegments, missingDayCount, mergeStations, formatBytes } from "./seismic-admin-utils";
import { StationConfig } from "../../shared/seismic/seismic-types";
import { getStationChannelPrefix } from "../../shared/seismic/tile-addressing";

describe("seismic-admin-utils", () => {
  it("builds run-length coverage segments over [firstDay, lastDay]", () => {
    const segs = coverageSegments(new Set([10, 12, 13]), 10, 13);
    expect(segs).toEqual([
      { startDay: 10, endDay: 10, cached: true },
      { startDay: 11, endDay: 11, cached: false },
      { startDay: 12, endDay: 13, cached: true },
    ]);
  });

  it("counts missing days in range", () => {
    const cachedDays = new Set([10, 12]);
    expect(missingDayCount(cachedDays.size, 10, 13)).toBe(2); // 11, 13 missing
  });

  it("merges by (network, station, channel); catalog supplies location + label", () => {
    const opfs = [{ network: "AK", station: "K204", channel: "HNZ" }];
    const k204 = { network: "AK", station: "K204", location: "--", channel: "HNZ", label: "Anchorage" };
    const rc01 = { network: "AK", station: "RC01", location: "", channel: "BHZ", label: "Rabbit Creek" };
    const catalog: StationConfig[] = [k204, rc01];
    const merged = mergeStations(opfs, catalog);
    // K204 is in both → single entry from the catalog (location + label)
    expect(merged.get(getStationChannelPrefix(k204))).toEqual(
      { network: "AK", station: "K204", location: "--", channel: "HNZ", label: "Anchorage" });
    expect(merged.get(getStationChannelPrefix(rc01))?.label).toBe("Rabbit Creek");
  });

  it("formats byte sizes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });

  it("keeps OPFS-only stations with no location (not downloadable)", () => {
    const station = { network: "AK", station: "XYZ", channel: "HNZ" };
    const merged = mergeStations([station], []);
    expect(merged.get(getStationChannelPrefix(station))).toEqual({ network: "AK", station: "XYZ", channel: "HNZ" });
    expect(merged.get(getStationChannelPrefix(station))?.location).toBeUndefined();
  });
});
