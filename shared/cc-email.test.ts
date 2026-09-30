import {isCCEmail} from "./cc-email";

describe("isCCEmail", () => {
  it("accepts any concord.org address", () => {
    expect(isCCEmail("someone@concord.org")).toBe(true);
  });

  it("accepts the other listed CC addresses", () => {
    expect(isCCEmail("doug@zoopdoop.com")).toBe(true);
    expect(isCCEmail("lbond@alum.mit.edu")).toBe(true);
    expect(isCCEmail("fristoe@gmail.com")).toBe(true);
  });

  it("rejects an unrelated address", () => {
    expect(isCCEmail("someone@example.com")).toBe(false);
  });
});
