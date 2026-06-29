import { ENavTab } from "../../models/view/nav-tabs";

type HideChatRule = (activeTab: string, userType: string) => boolean;

// Rules that hide the comment/chat control for a given user on a given tab. These are keyed on the
// active tab's identity (ENavTab), NOT its position in the nav bar. An earlier version keyed the
// students-can't-comment-on-Problems rule on tabIndex === 0, which assumed Problems was always the
// first tab; units that order tabs differently (e.g. aplus, where Problems is third) broke as a
// result (CLUE-562).
const hideChatRules: HideChatRule[] = [
  // Students cannot comment on the Problems tab.
  (activeTab, userType) => userType === "student" && activeTab === ENavTab.kProblems,
];

export function shouldHideChat(activeTab: string | undefined, userType: string | undefined): boolean {
  if (!activeTab || !userType) return false;
  return hideChatRules.some(rule => rule(activeTab, userType));
}
