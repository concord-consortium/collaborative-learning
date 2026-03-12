jest.mock("seisplotjs", () => ({
  miniseed: {
    parseDataRecords: jest.fn().mockReturnValue([{ stub: true }]),
    merge: jest.fn().mockReturnValue({ numPoints: 42 }),
  },
  seismogram: {},
}));

import { TimelineContentModel } from "./timeline-content";

describe("TimelineContent", () => {
  it("is always user resizable", () => {
    const content = TimelineContentModel.create();
    expect(content.isUserResizable).toBe(true);
  });
});
