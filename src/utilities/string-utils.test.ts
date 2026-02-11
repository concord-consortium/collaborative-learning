import { upperWords } from "./string-utils";

describe("upperWords", () => {
  it("capitalizes the first letter of each word", () => {
    const input = "hello world from concord";
    const expected = "Hello World From Concord";
    expect(upperWords(input)).toBe(expected);
  });

  it("handles non-strings", () => {
    const num = 12345;
    expect(upperWords(num as any)).toBe(num);

    const obj = { key: "value" };
    expect(upperWords(obj as any)).toBe(obj);
  });
});
