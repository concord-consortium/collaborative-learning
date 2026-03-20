// shared/seismic/earthscope-client.test.ts
import { fetchStationMetadata } from "./earthscope-client";
import fetchMock from "jest-fetch-mock";

// Example response from EarthScope FDSN Station service (pipe-delimited text)
const MOCK_RESPONSE = `#Network|Station|Location|Channel|Latitude|Longitude|Elevation|Depth|Azimuth|Dip|SensorDescription|Scale|ScaleFreq|ScaleUnits|SampleRate|StartTime|EndTime
AK|K204|--|BHZ|64.9753|-148.158|295.0|0.0|0.0|-90.0|Streckeisen STS-2|213947.0|0.02|M/S**2|50.0|2019-09-17T00:00:00|
AK|K204|--|BNZ|64.9753|-148.158|295.0|0.0|0.0|-90.0|Kinemetrics FBA-23|1677720.0|1.0|M/S**2|50.0|2019-09-17T00:00:00|`;

describe("earthscope-client", () => {
  beforeEach(() => {
    fetchMock.resetMocks();
  });

  it("parses station metadata from text response", async () => {
    fetchMock.mockResponseOnce(MOCK_RESPONSE);

    const channels = await fetchStationMetadata("AK", "K204");
    expect(channels).toHaveLength(2);

    expect(channels[0].channel).toBe("BHZ");
    expect(channels[0].scale).toBe(213947.0);
    expect(channels[0].scaleUnits).toBe("M/S**2");
    expect(channels[0].sampleRate).toBe(50.0);
    expect(channels[0].instrumentCode).toBe("H");
  });

  it("extracts instrument code from channel name", async () => {
    fetchMock.mockResponseOnce(MOCK_RESPONSE);

    const channels = await fetchStationMetadata("AK", "K204");
    expect(channels[1].instrumentCode).toBe("N");
  });

  it("throws on HTTP error", async () => {
    fetchMock.mockResponseOnce("", { status: 404 });

    await expect(fetchStationMetadata("XX", "FAKE")).rejects.toThrow();
  });
});
