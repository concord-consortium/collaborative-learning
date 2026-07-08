import { decideContext, hashString } from "./right-context";

describe("hashString", () => {
  it("is deterministic and distinguishes different strings", () => {
    expect(hashString("workspace summary")).toBe(hashString("workspace summary"));
    expect(hashString("workspace summary")).not.toBe(hashString("workspace summary!"));
  });
});

describe("decideContext", () => {
  it("attaches RIGHT on the first send (no hash sent yet)", () => {
    const decision = decideContext({
      leftAlreadyInstalled: false,
      currentRightHash: "abc",
      lastSentRightHash: undefined
    });
    expect(decision.attachRight).toBe(true);
  });

  it("omits RIGHT when the hash is unchanged since the last send", () => {
    const decision = decideContext({
      leftAlreadyInstalled: true,
      currentRightHash: "abc",
      lastSentRightHash: "abc"
    });
    expect(decision.attachRight).toBe(false);
  });

  it("re-attaches RIGHT when the summary hash changed", () => {
    const decision = decideContext({
      leftAlreadyInstalled: true,
      currentRightHash: "def",
      lastSentRightHash: "abc"
    });
    expect(decision.attachRight).toBe(true);
  });

  it("attaches LEFT while the parent's problemInstalled flag is unset", () => {
    // Covers both the not-yet-created-parent first send and the recovery
    // resend after the server refused to set the flag on an empty LEFT.
    expect(decideContext({
      leftAlreadyInstalled: false,
      currentRightHash: "abc",
      lastSentRightHash: "abc"
    }).attachLeft).toBe(true);
  });

  it("omits LEFT once the parent's problemInstalled flag is set", () => {
    expect(decideContext({
      leftAlreadyInstalled: true,
      currentRightHash: "abc",
      lastSentRightHash: undefined
    }).attachLeft).toBe(false);
  });
});
