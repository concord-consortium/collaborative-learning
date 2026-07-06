// shared/seismic/earthscope-client.test.ts
import {
  fetchRawSeismicData, fetchStationMetadata, fetchAvailability, isProxyEnabled, getLocalBaseUrl
} from "./earthscope-client";
import { utcDay } from "./seismic-day";
import fetchMock from "jest-fetch-mock";

// Example response from EarthScope FDSN Station service (pipe-delimited text)
const MOCK_RESPONSE = `#Network|Station|Location|Channel|Latitude|Longitude|Elevation|Depth|Azimuth|Dip|SensorDescription|Scale|ScaleFreq|ScaleUnits|SampleRate|StartTime|EndTime
AK|K204|--|BHZ|64.9753|-148.158|295.0|0.0|0.0|-90.0|Streckeisen STS-2|213947.0|0.02|M/S**2|50.0|2019-09-17T00:00:00|
AK|K204|--|BNZ|64.9753|-148.158|295.0|0.0|0.0|-90.0|Kinemetrics FBA-23|1677720.0|1.0|M/S**2|50.0|2019-09-17T00:00:00|`;

const stationId = { network: "AK", station: "K204" };
const stationLocation = { ...stationId, location: "", channel: "HNZ" };
const stationTimeRange = { ...stationLocation, startTime: "2026-01-30T00:00:00Z", endTime: "2026-01-31T00:00:00Z" };

describe("earthscope-client", () => {
  beforeEach(() => {
    fetchMock.resetMocks();
  });

  it("parses station metadata from text response", async () => {
    fetchMock.mockResponseOnce(MOCK_RESPONSE);

    const channels = await fetchStationMetadata(stationId);
    expect(channels).toHaveLength(2);

    expect(channels[0].channel).toBe("BHZ");
    expect(channels[0].scale).toBe(213947.0);
    expect(channels[0].scaleUnits).toBe("M/S**2");
    expect(channels[0].sampleRate).toBe(50.0);
    expect(channels[0].instrumentCode).toBe("H");
  });

  it("extracts instrument code from channel name", async () => {
    fetchMock.mockResponseOnce(MOCK_RESPONSE);

    const channels = await fetchStationMetadata(stationId);
    expect(channels[1].instrumentCode).toBe("N");
  });

  it("throws on HTTP error", async () => {
    fetchMock.mockResponseOnce("", { status: 404 });

    await expect(fetchStationMetadata({ network: "XX", station: "FAKE" })).rejects.toThrow();
  });
});

describe("fetchRawSeismicData", () => {
  const setUrl = (url: string) => (global as any).jsdom.reconfigure({ url });

  beforeEach(() => {
    fetchMock.resetMocks();
    // Reset to a URL with no query params
    setUrl("http://localhost/");
  });

  it("fetches from mock S3 when no URL params are set", async () => {
    fetchMock.mockResponseOnce(new ArrayBuffer(8) as any);

    const response = await fetchRawSeismicData(stationTimeRange);

    expect(response).toBeDefined();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("2026_01_30"),
      expect.anything()
    );
  });

  it("throws when mock has no data for the requested range", async () => {
    await expect(
      fetchRawSeismicData({ ...stationLocation, startTime: "2020-01-01T00:00:00Z", endTime: "2020-01-02T00:00:00Z" })
    ).rejects.toThrow("No mock data available");
  });

  it("fetches from proxy when seismicProxy URL param is set", async () => {
    setUrl("http://localhost/?seismicProxy");

    fetchMock.mockResponseOnce(new ArrayBuffer(8) as any);

    const response = await fetchRawSeismicData(stationTimeRange);

    expect(response).toBeDefined();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("seismic-data.concord.org"),
      expect.anything()
    );
  });

  it("passes location to proxy URL, mapping empty to '--'", async () => {
    setUrl("http://localhost/?seismicProxy");
    fetchMock.mockResponseOnce(new ArrayBuffer(8) as any);

    await fetchRawSeismicData(stationTimeRange);

    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("loc=--");
  });

  it("passes non-empty location to proxy URL", async () => {
    setUrl("http://localhost/?seismicProxy");
    fetchMock.mockResponseOnce(new ArrayBuffer(8) as any);

    await fetchRawSeismicData({
      ...stationTimeRange, station: "DDM", location: "01"
    });

    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("loc=01");
  });
});

describe("fetchAvailability", () => {
  const setUrl = (url: string) => (global as any).jsdom.reconfigure({ url });

  // EarthScope availability text: Net|Sta|Loc|Chan|Quality|SampleRate|Earliest|Latest
  const AVAILABILITY_TEXT = `#Network Station Location Channel Quality SampleRate Earliest Latest
AK K204 -- HNZ M 100.0 2026-01-30T00:00:00.000000Z 2026-02-01T00:00:00.000000Z
AK K204 -- HNZ M 100.0 2026-02-03T00:00:00.000000Z 2026-02-04T00:00:00.000000Z`;

  beforeEach(() => {
    fetchMock.resetMocks();
    setUrl("http://localhost/");
  });

  it("parses availability ranges into [startSec, endSec) pairs (proxy mode)", async () => {
    setUrl("http://localhost/?seismicProxy");
    fetchMock.mockResponseOnce(AVAILABILITY_TEXT);

    const ranges = await fetchAvailability(stationTimeRange);

    expect(ranges).toEqual([
      { start: utcDay(2026, 1, 30), end: utcDay(2026, 2, 1) },
      { start: utcDay(2026, 2, 3), end: utcDay(2026, 2, 4) },
    ]);
  });

  it("falls back to the full requested range when not in proxy mode", async () => {
    const ranges = await fetchAvailability({ ...stationTimeRange, endTime: "2026-02-05T00:00:00.000Z" });
    expect(ranges).toEqual([
      { start: utcDay(2026, 1, 30), end: utcDay(2026, 2, 5) },
    ]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("fetch config override", () => {
  const setUrl = (url: string) => (global as any).jsdom.reconfigure({ url });

  const AVAILABILITY_TEXT = `#Network Station Location Channel Quality SampleRate Earliest Latest
AK K204 -- HNZ M 100.0 2026-01-30T00:00:00.000000Z 2026-02-01T00:00:00.000000Z
AK K204 -- HNZ M 100.0 2026-02-03T00:00:00.000000Z 2026-02-04T00:00:00.000000Z`;

  beforeEach(() => {
    fetchMock.resetMocks();
    setUrl("http://localhost/"); // no proxy/local param in the "page" URL
  });

  it("isProxyEnabled and getLocalBaseUrl reads the window params", () => {
    setUrl("http://localhost/?seismicProxy");
    expect(isProxyEnabled()).toEqual(true);
    expect(getLocalBaseUrl()).toEqual(null);
    setUrl("http://localhost/?seismicLocal=http://data.local");
    expect(isProxyEnabled()).toEqual(false);
    expect(getLocalBaseUrl()).toEqual("http://data.local");
  });

  it("fetchRawSeismicData honors an explicit proxy even without the window param", async () => {
    fetchMock.mockResponseOnce(new ArrayBuffer(8) as any);
    await fetchRawSeismicData(stationTimeRange, { baseUrl: null, proxy: true });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("seismic-data.concord.org"), expect.anything()
    );
  });

  it("fetchAvailability honors an explicit proxy (hits the service, not the fallback)", async () => {
    fetchMock.mockResponseOnce(AVAILABILITY_TEXT);
    const ranges = await fetchAvailability(
      { ...stationTimeRange, endTime: "2026-02-05T00:00:00.000Z" },
      { baseUrl: null, proxy: true }
    );
    expect(fetchMock).toHaveBeenCalled();
    expect(ranges).toHaveLength(2);
  });
});
