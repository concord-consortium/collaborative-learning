// mock the measureText function
const mockMeasureText = jest.fn((text: string, fontSize: number) => {
  // assume every character is half the width of the font's height
  const width = text.length * fontSize / 2;
  return { width };
});

// mock the 2D canvas context
class MockCanvas2DContext {
  font: string;

  get fontSize() {
    const match = /(\d+)/.exec(this.font || "");
    const sizeStr = match?.[1];
    return sizeStr ? +sizeStr : 16;
  }

  measureText(text: string) {
    return mockMeasureText(text, this.fontSize);
  }
}

// mock document.createElement to return a "canvas" element that returns our mock 2D context
const mockCreateElement = jest.spyOn(document, "createElement").mockImplementation(() => ({
  getContext: () => new MockCanvas2DContext()
} as any as HTMLCanvasElement));

import { defaultFont } from "../../constants";
import { measureText, measureTextLines } from "./use-measure-text";

describe("measureText", () => {
  const testText = "test text";
  const testText2 = "another string to test";
  const otherFont = "bold 20px serif";

  beforeEach(() => {
    mockMeasureText.mockClear();
  });

  afterAll(() => {
    mockCreateElement.mockRestore();
  });

  it("returns the same value for default font", () => {
    expect(measureText(testText)).toEqual(measureText(testText, defaultFont));
    // second call returns cached result
    expect(mockMeasureText).toHaveBeenCalledTimes(1);
  });
  it("returns different lengths for different strings", () => {
    expect(measureText(testText)).not.toEqual(measureText(testText2));
    // one result was cached by the previous test
    expect(mockMeasureText).toHaveBeenCalledTimes(1);
  });
  it("returns different lengths for different fonts", () => {
    expect(measureText(testText)).not.toEqual(measureText(testText, otherFont));
    // one result was cached by the previous test
    expect(mockMeasureText).toHaveBeenCalledTimes(1);
  });
  it("is consistent after multiple strings and fonts", () => {
    expect(measureText(testText)).toEqual(measureText(testText));
    // both results were cached by previous tests
    expect(mockMeasureText).toHaveBeenCalledTimes(0);
  });
});

// Each character is 7px wide
// Each line is 70px wide, so 10 characters
const lineWidth = 70;
const mtl = (text: string) => measureTextLines(text, lineWidth);
describe("measureTextLines", () => {
  beforeEach(() => {
    mockMeasureText.mockClear();
  });

  afterAll(() => {
    mockCreateElement.mockRestore();
  });

  it("handles empty strings", () => {
    expect(mtl("")).toEqual(1);
  });
  it("handles short words", () => {
    expect(mtl("abcd")).toEqual(1);
  });
  it("handles words of the exact line length", () => {
    expect(mtl("abcdefghij")).toEqual(1);
  });
  it("handles long words", () => {
    expect(mtl("abcdefghijk")).toEqual(2);
  });
  it("handles multiple words", () => {
    expect(mtl("abcde fghij")).toEqual(2);
    expect(mtl("abcde fghij klmn")).toEqual(2);
  });
  it("handles multiple long words", () => {
    expect(mtl("a reallongword")).toEqual(3);
  });
  it("handles unusual whitespace", () => {
    expect(mtl("       a   \t\t    lot    \n\n     \nof       \t\t\n whitespace\n\n\n\n   \n\n\t")).toEqual(2);
  });
  it("doesn't include trailing spaces on the next line", () => {
    expect(mtl("tenletters tenletters")).toEqual(2);
  });
  it("returns the maximum line count when appropriate", () => {
    expect(measureTextLines("tenletters tenletters", lineWidth, defaultFont, 1)).toEqual(1);
  });
});
