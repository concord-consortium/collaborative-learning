import { TimelineContentModel } from "./timeline-content";

describe.skip("TimelineContent", () => {
  it("is always user resizable", () => {
    const content = TimelineContentModel.create();
    expect(content.isUserResizable).toBe(true);
  });
});
