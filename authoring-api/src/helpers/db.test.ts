import {escapeFirebaseKey, unescapeFirebaseKey} from "./db";

describe("escapeFirebaseKey / unescapeFirebaseKey", () => {
  it("escapes the characters Firebase keys disallow", () => {
    expect(escapeFirebaseKey("images/photo.png")).toBe("images%2Fphoto%2Epng");
  });

  it("round-trips ordinary keys", () => {
    const key = "investigation-0/problem-1/introduction/content.json";
    expect(unescapeFirebaseKey(escapeFirebaseKey(key))).toBe(key);
  });

  it("escapes '%' so the mapping stays injective", () => {
    // Without escaping '%', a literal "data%231.png" and the escaped form of "data#1.png" would
    // both be "data%231%2Epng" and collide on the same Firebase key.
    const hashName = "data#1.png";
    const percentName = "data%231.png";
    expect(escapeFirebaseKey(hashName)).not.toBe(escapeFirebaseKey(percentName));
  });

  it("round-trips names containing '%' and the escape sequences it could be confused with", () => {
    for (const name of ["100%.png", "data%231.png", "a%2Eb.png", "%25.png", "café#1$[x].png"]) {
      expect(unescapeFirebaseKey(escapeFirebaseKey(name))).toBe(name);
    }
  });
});
