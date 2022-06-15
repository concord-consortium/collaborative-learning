import { measureText } from "./use-measure-text";

describe("measureText", () => {
  const testText = "test text";
  const size1 = measureText(testText);
  const testText2 = "another string to test";
  const sizeOtherString = measureText(testText2);
  const otherFont = "bold 20px serif";
  const sizeOtherFont = measureText(testText, otherFont);
  const size2 = measureText(testText);

  it("returns different lengths for different strings", () => {
    expect(size1).not.toEqual(sizeOtherString);
  });
  it("returns different lengths for different fonts", () => {
    expect(size1).not.toEqual(sizeOtherFont);
  });
  it("is consistent after multiple strings and fonts", () => {
    expect(size1).toEqual(size2);
  });
});
