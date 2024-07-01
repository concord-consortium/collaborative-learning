import { countWords, isImageUrl } from "./string-utils";

it ("countWords should return the number of words in a string", () => {
  expect(countWords("")).toBe(0);
  expect(countWords("hello")).toBe(1);
  expect(countWords("hello world")).toBe(2);
  expect(countWords("hello, world")).toBe(2);
});

it("isImageUrl should return true for valid image URLs", () => {
  expect(isImageUrl("https://concord.org/image.png")).toBe(true);
  expect(isImageUrl("http://concord.org/image.jpg")).toBe(true);
  expect(isImageUrl("data:image/png;base64,")).toBe(true);
  expect(isImageUrl("https://concord.org/image")).toBe(false);
  expect(isImageUrl("https://concord.org/image.txt")).toBe(false);
});
