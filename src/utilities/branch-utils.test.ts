import { stripPTNumberFromBranch } from "./branch-utils";

describe("stripPTNumberFromBranch", () => {

  it("returns a branch without a number", () => {
    const b = "example-branch";
    expect(stripPTNumberFromBranch(b)).toBe(b);
  });

  it("strips pt numbers from beginning and end", () => {
    const bBase = "example-branch";
    const bStart = `123456789-${bBase}`;
    const bEnd = `${bBase}-987654321`;
    expect(stripPTNumberFromBranch(bStart)).toBe(bBase);
    expect(stripPTNumberFromBranch(bEnd)).toBe(bBase);
  });
});
