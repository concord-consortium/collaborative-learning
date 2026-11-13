import {
  getSaveStoppedNotice, isRepeatedUnrecordedChange, kUnrecordedChangeRepeatMs, resetUnrecordedChangeRepeatsForTesting
} from "./save-stopped-notice";

describe("getSaveStoppedNotice", () => {
  it("lets the user close the notice when the document still looks right", () => {
    expect(getSaveStoppedNotice("timed-out-entry")).toMatchObject({ dismissible: true, offerReload: true });
    expect(getSaveStoppedNotice("saved-id-missing")).toMatchObject({ dismissible: true, offerReload: false });
  });

  it("blocks editing when further edits might not be kept, and offers a reload only when it may help", () => {
    expect(getSaveStoppedNotice("unrecorded-change")).toMatchObject({ dismissible: false, offerReload: true });
    expect(getSaveStoppedNotice("unrecorded-change", true)).toMatchObject({ dismissible: false, offerReload: false });
    expect(getSaveStoppedNotice("initial-apply-failed")).toMatchObject({ dismissible: false, offerReload: false });
    expect(getSaveStoppedNotice("remote-apply-failed")).toMatchObject({ dismissible: false, offerReload: true });
  });

  it("tells the user to ask their teacher only when reloading won't help", () => {
    expect(getSaveStoppedNotice("unrecorded-change")?.message).not.toContain("teacher");
    expect(getSaveStoppedNotice("unrecorded-change", true)?.message).toContain("tell your teacher");
    expect(getSaveStoppedNotice("initial-apply-failed")?.message).toContain("tell your teacher");
  });

  it("shows nothing for a reason that doesn't happen on a concurrent document", () => {
    expect(getSaveStoppedNotice("catch-up-hole")).toBeUndefined();
  });
});

describe("isRepeatedUnrecordedChange", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    resetUnrecordedChangeRepeatsForTesting();
  });

  it("counts a second unrecorded change in a later page load soon after the first as a repeat", () => {
    expect(isRepeatedUnrecordedChange("d1", 1000)).toBe(false);
    resetUnrecordedChangeRepeatsForTesting();
    expect(isRepeatedUnrecordedChange("d1", 1000 + kUnrecordedChangeRepeatMs - 1)).toBe(true);
    expect(isRepeatedUnrecordedChange("d2", 1000)).toBe(false);
  });

  it("doesn't count one long after the first, or ask again within one page load", () => {
    expect(isRepeatedUnrecordedChange("d1", 1000)).toBe(false);
    expect(isRepeatedUnrecordedChange("d1", 2000)).toBe(false);
    resetUnrecordedChangeRepeatsForTesting();
    expect(isRepeatedUnrecordedChange("d1", 1000 + kUnrecordedChangeRepeatMs)).toBe(false);
  });

  it("counts every page load as the first without session storage", () => {
    const getItem = jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    try {
      expect(isRepeatedUnrecordedChange("d1", 1000)).toBe(false);
    } finally {
      getItem.mockRestore();
    }
  });
});
