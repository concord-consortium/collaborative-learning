import { TimelineContentModel } from "./timeline-content";

describe("TimelineContent", () => {
  it("is always user resizable", () => {
    const content = TimelineContentModel.create();
    expect(content.isUserResizable).toBe(true);
  });
});
