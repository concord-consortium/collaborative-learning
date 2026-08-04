import { getMetadataForChannel } from "./channel-metadata-utils";
import { ChannelMetadata } from "./seismic-types";

function makeMetadata(overrides: Partial<ChannelMetadata>): ChannelMetadata {
  return {
    network: "AK", station: "K204", channel: "HNZ", location: "00",
    startTime: "2020-01-01T00:00:00Z", endTime: "",
    scale: 100, scaleFreq: 1, scaleUnits: "m/s", sampleRate: 100, instrumentCode: "N",
    ...overrides,
  };
}

const secondsAt = (iso: string) => new Date(iso).getTime() / 1000;

describe("getMetadataForChannel", () => {
  const station = { channel: "HNZ", location: "00" };

  it("returns the entry whose epoch covers timeSec", () => {
    const early = makeMetadata({ startTime: "2020-01-01T00:00:00Z", endTime: "2022-01-01T00:00:00Z", scale: 50 });
    const late = makeMetadata({ startTime: "2022-01-01T00:00:00Z", endTime: "", scale: 200 });
    const metadata = [early, late];
    expect(getMetadataForChannel(metadata, station, secondsAt("2021-06-01T00:00:00Z"))).toBe(early);
    // An open-ended endTime ("") covers all later times.
    expect(getMetadataForChannel(metadata, station, secondsAt("2030-01-01T00:00:00Z"))).toBe(late);
  });

  it("falls back to the last matching entry when no epoch covers timeSec", () => {
    const first = makeMetadata({ startTime: "2020-01-01T00:00:00Z", endTime: "2021-01-01T00:00:00Z" });
    const last = makeMetadata({ startTime: "2021-01-01T00:00:00Z", endTime: "2022-01-01T00:00:00Z" });
    expect(getMetadataForChannel([first, last], station, secondsAt("2019-01-01T00:00:00Z"))).toBe(last);
  });

  it("returns undefined when no entry matches the channel and location", () => {
    const metadata = [makeMetadata({ channel: "BHZ" }), makeMetadata({ location: "10" })];
    expect(getMetadataForChannel(metadata, station, secondsAt("2021-01-01T00:00:00Z"))).toBeUndefined();
  });
});
