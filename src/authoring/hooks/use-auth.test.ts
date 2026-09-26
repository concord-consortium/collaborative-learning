import { isAdminEmail } from "./use-auth";

// isAdminEmail is a thin wrapper for isCCEmail whose own address list is tested directly in shared/cc-email.test.ts,
// so this only covers what it adds beyond that: delegating to isCCEmail, and the fake dev/test user allowance.
describe("isAdminEmail", () => {
  it("accepts a Concord Consortium email (delegates to isCCEmail)", () => {
    expect(isAdminEmail("someone@concord.org")).toBe(true);
  });

  it("accepts the fake dev/test user", () => {
    expect(isAdminEmail("fakeuser@example.com")).toBe(true);
  });

  it("rejects an unrelated address", () => {
    expect(isAdminEmail("someone@example.com")).toBe(false);
  });
});
