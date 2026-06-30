import { ENavTab } from "../../models/view/nav-tabs";
import { shouldHideChat } from "./should-hide-chat";

describe("shouldHideChat", () => {
  // CLUE-562: keyed on tab identity, not position. aplus orders class-work first and Problems
  // third, so an index-based rule hid chat on class-work and showed it on Problems — backwards.
  it("hides chat for students on the Problems tab regardless of its position", () => {
    expect(shouldHideChat(ENavTab.kProblems, "student")).toBe(true);
  });

  it("does NOT hide chat for students on other tabs (e.g. class-work, which can be first)", () => {
    expect(shouldHideChat(ENavTab.kClassWork, "student")).toBe(false);
    expect(shouldHideChat(ENavTab.kSortWork, "student")).toBe(false);
    expect(shouldHideChat(ENavTab.kMyWork, "student")).toBe(false);
  });

  it("does not hide chat for teachers on the Problems tab", () => {
    expect(shouldHideChat(ENavTab.kProblems, "teacher")).toBe(false);
  });

  it("returns false when the active tab or user type is undefined", () => {
    expect(shouldHideChat(undefined, "student")).toBe(false);
    expect(shouldHideChat(ENavTab.kProblems, undefined)).toBe(false);
  });
});
