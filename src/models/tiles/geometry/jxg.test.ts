import "./jxg";

describe("JSXGraph library", () => {

  it("JXG is available", () => {
    expect(JXG).toBeDefined();
    // test a few utility functions to verify library is loaded correctly
    expect(JXG._round10(3.14159, -2)).toBe(3.14);
    expect(JXG.toFixed(-0.000001, 2)).toBe("0.00");
  });
});
