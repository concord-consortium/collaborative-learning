import { DateTime } from "luxon";
import { SharedSeismogram, kSharedSeismogramType, isSharedSeismogram } from "./shared-seismogram";

describe("SharedSeismogram", () => {
  it("has the correct type", () => {
    const model = SharedSeismogram.create();
    expect(model.type).toBe(kSharedSeismogramType);
  });

  it("starts with no station data", () => {
    const model = SharedSeismogram.create();
    expect(model.station).toBeUndefined();
    expect(model.startTime).toBeUndefined();
    expect(model.endTime).toBeUndefined();
  });

  it("setStation updates station fields", () => {
    const model = SharedSeismogram.create();
    model.setStation({ network: "AK", station: "K204", location: "", channel: "HNZ" });
    expect(model.station?.network).toBe("AK");
    expect(model.station?.station).toBe("K204");
    expect(model.station?.location).toBe("");
    expect(model.station?.channel).toBe("HNZ");
  });

  it("setTimeRange updates time fields", () => {
    const model = SharedSeismogram.create();
    const start = DateTime.fromISO("2026-01-30T00:00:00.000Z");
    const end = DateTime.fromISO("2026-02-06T00:00:00.000Z");
    model.setTimeRange(start.toISO()!, end.toISO()!);
    expect(model.startTime?.toMillis()).toBe(start.toMillis());
    expect(model.endTime?.toMillis()).toBe(end.toMillis());
  });

  it("isSharedSeismogram returns true for a SharedSeismogram instance", () => {
    const model = SharedSeismogram.create();
    expect(isSharedSeismogram(model)).toBe(true);
  });
});
