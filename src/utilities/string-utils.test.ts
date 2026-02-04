import { upperWords } from "./string-utils";

describe("upperWords", () => {
  it("capitalizes the first letter of each word", () => {
    const input = "hello world from concord";
    const expected = "Hello World From Concord";
    expect(upperWords(input)).toBe(expected);
  });
});
