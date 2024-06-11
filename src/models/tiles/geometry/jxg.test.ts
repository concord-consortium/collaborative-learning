import JXG from "jsxgraph";

describe("JSXGraph library", () => {

  it("JXG is available", () => {
    expect(JXG).toBeDefined();
    // test a few utility functions to verify library is loaded correctly
    expect(JXG.supportsSVG()).toBe(true);
    expect(JXG.toFixed(-0.000001, 2)).toBe("0.00");
  });
});
