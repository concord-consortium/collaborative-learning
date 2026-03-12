jest.mock("seisplotjs", () => ({
  miniseed: {
    parseDataRecords: jest.fn().mockReturnValue([{ stub: true }]),
    merge: jest.fn().mockReturnValue({ numPoints: 42 }),
  },
  seismogram: {},
}));

import { WaveRunnerContentModel } from "./wave-runner-content";

describe("WaveRunnerContent", () => {
  it("is always user resizable", () => {
    const content = WaveRunnerContentModel.create();
    expect(content.isUserResizable).toBe(true);
  });
});
