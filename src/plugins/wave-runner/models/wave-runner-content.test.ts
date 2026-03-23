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
});
