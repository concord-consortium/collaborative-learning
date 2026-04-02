import { DateTime } from "luxon";
import { SeismicQueryService, envelopeCacheKey, rawCacheKey } from "./seismic-query-service";

describe("SeismicQueryService", () => {
  describe("selectLevel", () => {
    let service: SeismicQueryService;
    const t0 = DateTime.fromSeconds(0, { zone: "utc" });

    function selectLevelFromSecondsPerPixel(spp: number) {
      return service.selectLevel(t0, DateTime.fromSeconds(spp * 1000, { zone: "utc" }), 1000);
    }

    beforeEach(() => {
      service = new SeismicQueryService();
    });

    it("selects L0 when secondsPerPixel >= L0 spacing (15750)", () => {
      expect(selectLevelFromSecondsPerPixel(15750)).toBe(0);
      expect(selectLevelFromSecondsPerPixel(20000)).toBe(0);
    });

    it("selects L1 when secondsPerPixel >= L1 spacing (157.5)", () => {
      expect(selectLevelFromSecondsPerPixel(157.5)).toBe(1);
      expect(selectLevelFromSecondsPerPixel(1000)).toBe(1);
    });

    it("selects L2 when secondsPerPixel >= L2 spacing (1.575)", () => {
      expect(selectLevelFromSecondsPerPixel(1.575)).toBe(2);
      expect(selectLevelFromSecondsPerPixel(10)).toBe(2);
    });

    it("selects raw when secondsPerPixel < L2 spacing", () => {
      expect(selectLevelFromSecondsPerPixel(1)).toBe("raw");
      expect(selectLevelFromSecondsPerPixel(0.01)).toBe("raw");
    });
  });
});
