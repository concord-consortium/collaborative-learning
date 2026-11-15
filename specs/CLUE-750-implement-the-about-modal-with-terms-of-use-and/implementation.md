# Implementation Plan: About CLUE Modal with Terms of Use and Licensing

**Jira**: https://concord-consortium.atlassian.net/browse/CLUE-750
**Requirements Spec**: [requirements.md](requirements.md)
**Status**: **In Development**

## Approach

The modal is a `useCustomModal` dialog, the hook behind CLUE's standard dialogs, so the chrome (gray title bar, teal border, ×, footer buttons), `role="dialog"`, `aria-modal`, the title as accessible name, focus trapping, Escape and focus return all come from existing code. Throwaway tests run while speccing confirmed each of those against the real `CustomSelect` trigger. A `useAboutDialog()` hook owns the `useCustomModal` call; `ClueAppHeaderComponent` calls it once (above its early returns) and hands the opener to both menu containers as an `onShowAbout` prop, since those containers are class components and cannot call hooks.

Two small fixes to shared components come first, because the About item and modal depend on them: `CustomSelect` gains action items that never become the selected value (R3), and `useCustomModal` stops treating Enter on a focused link as "press the default button" (R19).

For CLUE-804 (R22): the libraries view adds a `view` state inside `useAboutDialog`, derives `title` from it, passes `view` and a setter through `contentProps`, and lists `[view]` as `useCustomModal`'s dependencies. A throwaway test confirmed that a `useCustomModal` title re-renders while open when its dependencies change. Nothing here builds that state.

## Implementation Plan

### Treat action items in CustomSelect as actions, not values

**Summary**: Add `isAction` to `ICustomDropdownItem`. An action item runs its `onClick` but is never the initial selection, never becomes the selection when chosen, and so never supplies the header text or `aria-selected`. Mark the existing "Log Out" and "Copy Shareable Link" items as actions. Independent of the rest of the story and reviewable alone.

**Files affected**:
- `src/clue/components/custom-select.tsx`: `isAction` prop; initial selection and `handleSelect` skip action items
- `src/components/student-menu-container.tsx`: `isAction: true` on "Log Out"
- `src/components/class-menu-container.tsx`: `isAction: true` on "Log Out" and "Copy Shareable Link"
- `src/clue/components/custom-select.test.tsx`: action-item tests

**Estimated diff size**: ~80 lines

```tsx
// custom-select.tsx
export interface ICustomDropdownItem extends IDropdownItem {
  id?: string;
  itemIcon?: ReactNode;
  hideItemCheck?: boolean;
  bottomBorder?: boolean;
  /** Runs onClick without becoming the selected value, e.g. "Log Out". */
  isAction?: boolean;
}

const [selected, setSelected] = useState(() =>
  items.find(item => item.selected)?.text || items.find(item => !item.isAction)?.text || ""
);

const handleSelect = useCallback((_element: HTMLElement, index: number) => {
  const item = items[index];
  if (!item || item.disabled) return;
  item.onClick?.(item);
  if (!item.isAction) {
    setSelected(item.text);
  }
}, [items]);
```

The `useEffect` that syncs `selected` from `items` already looks only at `item.selected`, which action items never set, so it needs no change.

**Tests** (in a new `describe("CustomSelect action items")`, using the file's `flushOpenEffect` and `openList` helpers):
- With items `[{ text: "Do it", isAction: true }, { text: "March", selected: true }, { text: "April" }]`: open, choose "Do it" by click; its `onClick` ran; "March" still has `aria-selected="true"` and "Do it" has none; reopen and `document.activeElement` is the "March" option. Catches removal of the `!item.isAction` guard in `handleSelect`.
- With `title=""`, `titlePrefix="Name"` and items `[{ text: "Do it", isAction: true }, { text: "March" }]` (none selected): the `[data-test=custom-select-title]` text is "March", not "Do it", and "Do it" has no `aria-selected`. Catches removal of the `!item.isAction` filter in the initial state.

---

### Let Enter follow a focused link in custom modals

**Summary**: `useCustomModal`'s capture-phase Enter handler sends Enter on anything but a select, textarea or button to the dialog's default button, so with a default button Enter on a link closed the dialog and cancelled the navigation (confirmed with a throwaway test). Return early for links, as it already does for buttons.

**Files affected**:
- `src/hooks/use-custom-modal.tsx`: anchor exemption
- `src/hooks/use-custom-modal.test.tsx`: a link in the test `Content`, and one test

**Estimated diff size**: ~20 lines

```tsx
// A focused button handles Enter itself (activating that button); don't
// also fire the default button, or Enter on Cancel/Close would still submit.
if (e.target instanceof HTMLButtonElement) return;

// Enter on a focused link follows the link.
if (e.target instanceof HTMLAnchorElement) return;
```

**Test**: add `<a href="#target" data-testid="link">link</a>` to the test `Content`; focus it, `fireEvent.keyDown(link, { key: "Enter" })`; expect `onDefaultClick` not called and `fireEvent`'s return value `true` (default not prevented).

---

### Add the CLUE block logo

**Summary**: The logo file on its own commit, so the asset is reviewable apart from code: the 4x PNG export (420 × 280, about 7.7 KB) of Zeplin's "CLUE Logo Small" layer, for the reason in requirements.md's Technical Notes.

**Files affected**:
- `src/assets/clue-block-logo.png` (new)

**Estimated diff size**: one asset file

Webpack's `asset` rule for `.png` inlines files under its default 8 KB limit as a data URI and emits larger ones to `assets/images/`; either works for an `<img src>`. Jest's `fileMock` maps the import to `test-file-stub`.

---

### Add ExternalLink and the About dialog

**Summary**: The dialog's content, its hook, and a small `ExternalLink` component (CODAP's, adapted) that CLUE-804 will also use. Nothing opens it yet.

**Files affected**:
- `src/components/utilities/external-link.tsx` (new)
- `src/components/utilities/external-link.test.tsx` (new)
- `src/components/about/about-dialog.tsx` (new)
- `src/components/about/about-dialog.scss` (new)
- `src/components/about/about-dialog.test.tsx` (new)

**Estimated diff size**: ~280 lines

```tsx
// external-link.tsx
import React from "react";
import { VisuallyHidden } from "@chakra-ui/react";

interface IProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "target" | "rel"> {
  href: string;
  showArrow?: boolean;
  children: React.ReactNode;
}

// A link that opens in a new tab and tells screen-reader users that it does.
export function ExternalLink({ href, showArrow, children, ...others }: IProps) {
  return (
    <a {...others} href={href} target="_blank" rel="noopener noreferrer">
      {children}
      {showArrow && <span aria-hidden="true"> ↗</span>}
      <VisuallyHidden> (opens in a new tab)</VisuallyHidden>
    </a>
  );
}
```

```tsx
// about-dialog.tsx
import React from "react";
import { useCustomModal } from "../../hooks/use-custom-modal";
import { useStores } from "../../hooks/use-stores";
import { IGitInfo } from "../../models/stores/base-stores-types";
import { ExternalLink } from "../utilities/external-link";
import clueBlockLogo from "../../assets/clue-block-logo.png";

import "./about-dialog.scss";

export const kMitLicenseUrl = "https://github.com/concord-consortium/collaborative-learning/blob/master/LICENSE";
export const kTermsOfUseUrl = "https://concord.org/terms-of-use/";
export const kLicensingUrl = "https://concord.org/licensing";
export const kLicensingEmail = "licensing@concord.org";
export const kSourceCodeUrl = "https://github.com/concord-consortium/collaborative-learning";

const kShortShaLength = 7;

export function getVersionText(version: string, gitSha?: string | null) {
  const build = gitSha?.slice(0, kShortShaLength);
  return build ? `Version ${version} · build ${build}` : `Version ${version}`;
}

interface IAboutDialogContentProps {
  appVersion: string;
  gitInfo: IGitInfo;
}

export const AboutDialogContent: React.FC<IAboutDialogContentProps> = ({ appVersion, gitInfo }) => {
  const year = new Date().getFullYear();
  return (
    <div className="about-dialog-body">
      <div className="about-dialog-identity">
        <img className="about-dialog-logo" src={clueBlockLogo} alt="CLUE" />
        <div className="about-dialog-product-of">a product of The Concord Consortium</div>
        <div className="about-dialog-tagline">Collaborative Learning User Environment</div>
        <div className="about-dialog-version" data-testid="about-dialog-version">
          {getVersionText(appVersion, gitInfo.gitSha)}
        </div>
        <div>© {year} The Concord Consortium, Inc.</div>
      </div>
      <hr className="about-dialog-divider" />
      <h2 className="about-dialog-heading">License &amp; Terms of Use</h2>
      <p className="about-dialog-text">
        <strong>CLUE is free, open-source software.</strong> The CLUE source code is released under
        the <ExternalLink href={kMitLicenseUrl}>MIT License</ExternalLink>, so you’re welcome to use,
        modify, and build on it.
      </p>
      <p className="about-dialog-text">
        <strong>Your use of CLUE at collaborative-learning.concord.org</strong> is governed by
        our <ExternalLink href={kTermsOfUseUrl}>Terms of Use</ExternalLink>. The hosted version is free
        for non-commercial use; commercial use requires a separate written agreement. For more
        information, visit <ExternalLink href={kLicensingUrl}>concord.org/licensing</ExternalLink> or
        contact <a href={`mailto:${kLicensingEmail}`}>{kLicensingEmail}</a>.
      </p>
      <hr className="about-dialog-divider" />
      <div className="about-dialog-links">
        <ExternalLink href={kTermsOfUseUrl} showArrow={true}>Terms of Use</ExternalLink>
        <ExternalLink href={kLicensingUrl} showArrow={true}>Licensing details</ExternalLink>
        <ExternalLink href={kSourceCodeUrl} showArrow={true}>Source on GitHub</ExternalLink>
      </div>
    </div>
  );
};

export function useAboutDialog() {
  const { appVersion, gitInfo } = useStores();
  const [showModal] = useCustomModal({
    className: "about-dialog",
    title: "About CLUE",
    Content: AboutDialogContent,
    contentProps: { appVersion, gitInfo },
    canCancel: true,
    buttons: [{ label: "Close", isDefault: true }],
    dataTestId: "about-dialog"
  });
  return showModal as () => void;
}
```

JSX whitespace: each line break inside the paragraphs collapses to one space, and every break above falls between words, so the rendered text matches R10. The test compares `textContent` (after stripping the hidden "(opens in a new tab)" spans) against the R10 strings, which catches a dropped space.

```scss
// about-dialog.scss
@import "../vars";

.custom-modal.about-dialog {
  width: 580px;
  max-width: calc(100vw - 40px);
  max-height: calc(100vh - 40px);

  .modal-content {
    justify-content: flex-start;
    min-height: 0;
    overflow-y: auto;
  }

  .about-dialog-body {
    color: $charcoal-dark-2;
    font-size: 14px;
    line-height: 1.5;

    a {
      color: $workspace-teal-dark-1;

      &:hover {
        color: $workspace-teal-dark-2;
      }
    }
  }

  .about-dialog-identity {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    text-align: center;
    font-size: 13px;
  }

  .about-dialog-logo {
    display: block;
    width: 135px;
    height: 90px;
  }

  .about-dialog-product-of {
    font-size: 11px;
    color: $charcoal-dark-1;
    margin-bottom: 4px;
  }

  .about-dialog-tagline {
    font-size: 14px;
  }

  .about-dialog-version {
    background-color: $charcoal-light-6;
    border-radius: 12px;
    padding: 3px 12px;
    user-select: text;
  }

  .about-dialog-divider {
    border: none;
    border-top: 1px solid $charcoal-light-4;
    margin: 14px 0;
    width: 100%;
  }

  .about-dialog-heading {
    font-size: 13px;
    font-weight: normal;
    color: $charcoal-dark-1;
    margin: 0 0 8px;
  }

  .about-dialog-text {
    font-size: 15px;
    margin: 0 0 8px;

    a {
      text-decoration: underline;
    }
  }

  .about-dialog-links {
    display: flex;
    flex-wrap: wrap;
    gap: 22px;
    font-size: 13px;

    a {
      text-decoration: none;

      &:hover {
        text-decoration: underline;
      }
    }
  }
}
```

Colors come from `vars.scss` rather than the mockup's hex values: `$workspace-teal-dark-1` is the mockup's link color exactly (#0481a0); the hover and gray text use the nearest palette entries.

**Tests** (`about-dialog.test.tsx`):
- `getVersionText`: a 40-character sha gives `build ` + its first 7 characters; `"dev"` gives `build dev`; `""`, `null` and `undefined` give `Version 4.3.0` with no build part. Each case asserts the exact string.
- `AboutDialogContent` rendered with `appVersion: "4.3.0"`, `gitInfo: { gitSha: "0123456789abcdef" }`:
  - `getByRole("img", { name: "CLUE" })`; "a product of The Concord Consortium", the tagline, `Version 4.3.0 · build 0123456`; the copyright line built from `new Date().getFullYear()` with `jest.useFakeTimers().setSystemTime(new Date("2031-06-01"))` so the expected `© 2031 ...` cannot come from a hardcoded current year.
  - `getByRole("heading", { name: "License & Terms of Use" })`.
  - Both paragraphs' text equals the R10 strings once the visually hidden spans are removed from a clone (`a span:not([aria-hidden])`).
  - A table of `[name, href]` for the four body links and three quick links, with the URLs written out as literals copied from R10 and R11 (not the exported `k*` constants, which would make the `href` checks true by construction): assert the table length (7) against `getAllByRole("link")` first, then each link's `href`; every link but the mailto has `target="_blank"` and `rel="noopener noreferrer"`; the mailto has no `target`.
- `useAboutDialog` via a harness (`ModalProvider`, `Modal.setAppElement("body")`, stores from `specStores({ appVersion: "4.3.0" })`, a trigger button that calls the opener; call `trigger.focus()` before `fireEvent.click(trigger)`, since `fireEvent.click` does not move focus and react-modal returns focus to whatever was focused at open): after opening, the dialog's `aria-labelledby` element reads "About CLUE" and `aria-modal="true"`; the footer Close button (the `.modal-button` named "Close"), the × (the `.modal-close` button, also named "Close"), and Escape (`fireEvent.keyDown(..., { keyCode: 27 })`) each close it, one per test; after each close `document.activeElement` is the trigger.

`external-link.test.tsx`: `target`, `rel`, the hidden "(opens in a new tab)" text, the arrow present and `aria-hidden` with `showArrow` and absent without it, and pass-through of other props (`className`).

---

### Add About CLUE to the user menus

**Summary**: Move the info icon to shared assets, add an `aboutMenuItem()` builder, and put the item first in both menu containers, opened through `useAboutDialog()` from the header.

**Files affected**:
- `src/plugins/timeline/assets/info-icon.svg` → `src/assets/icons/info-icon.svg` (`git mv`)
- `src/plugins/timeline/components/timeline-info-button.tsx`: import path
- `src/components/about/about-dialog.tsx`: `aboutMenuItem()`
- `src/components/student-menu-container.tsx`: `onShowAbout` prop; About item first; `showItemIcons`
- `src/components/class-menu-container.tsx`: same
- `src/clue/components/clue-app-header.tsx`: call `useAboutDialog()`; pass `onShowAbout` to both containers
- `src/clue/components/clue-app-header.scss`: menu item icon size
- `src/components/student-menu-container.test.tsx`: About item tests; existing test passes `onShowAbout`
- `src/components/class-menu-container.test.tsx` (new)

**Estimated diff size**: ~170 lines

```tsx
// about-dialog.tsx, added
import InfoIcon from "../../assets/icons/info-icon.svg";
import { ICustomDropdownItem } from "../../clue/components/custom-select";

export function aboutMenuItem(onShowAbout: () => void): ICustomDropdownItem {
  return {
    text: "About CLUE",
    itemIcon: <InfoIcon aria-hidden="true" />,
    isAction: true,
    hideItemCheck: true,
    bottomBorder: true,
    onClick: onShowAbout
  };
}
```

```tsx
// student-menu-container.tsx
interface IProps extends IBaseProps {
  onShowAbout: () => void;
}
...
const links: ICustomDropdownItem[] = [
  aboutMenuItem(this.props.onShowAbout),
  { text: "Log Out", isAction: true, selected: false, hideItemCheck: true, onClick: ... }
];
return (
  <CustomSelect titlePrefix={user.name} title={user.className} items={links}
    showItemIcons={true} dataTest="user" />
);
```

```tsx
// class-menu-container.tsx: after the standaloneAuthUser block
links.unshift(aboutMenuItem(this.props.onShowAbout));
...
<CustomSelect titlePrefix={user.name} title={user.className} items={links} showItemIcons={true} />
```

```tsx
// clue-app-header.tsx, with the other hooks at the top of the component
const showAboutDialog = useAboutDialog();
...
<ClassMenuContainer onShowAbout={showAboutDialog} />
...
<StudentMenuContainer onShowAbout={showAboutDialog} />
```

```scss
// clue-app-header.scss, inside .user
.custom-select .item-icon {
  display: flex;
  align-items: center;
  width: 16px;
  height: 16px;
  margin-right: 6px;

  svg {
    width: 16px;
    height: 16px;
  }
}
```

The divider is the existing `bottomBorder` style (a dashed `$workspace-teal-light-5` rule that already separates "Log Out" from the class list for standalone teachers), not the mockup's solid gray line, per R14, so the menu keeps one divider style (Doug's call).

**Tests**:
- `student-menu-container.test.tsx`: options in order are exactly `["About CLUE", "Log Out"]` (assert length, then names); `list-item-about-clue` has the `bottomBorder` class; clicking it calls `onShowAbout` once and does not call `getConfirmLogoutUrl`; the header title text is unchanged afterward. The existing Log Out test passes `onShowAbout={jest.fn()}`.
- Focus-return integration, in the same file: a wrapper component calls `useAboutDialog()` and renders `<StudentMenuContainer onShowAbout={...}/>` inside `ModalProvider`; open the menu with Enter on `user-header`, Enter on About CLUE, assert the dialog is open, Escape (`keyCode: 27`), assert `document.activeElement` is `user-header`.
- `class-menu-container.test.tsx` (new): a teacher created with `UserModel.create({ type: "teacher", className: "Class 1", portalClassOfferings: [...] })`, two offerings whose `unitCode: "NULL"` and `problemOrdinal: "0.0"` give the `problemPath` `specStores()` reports (`NULL/0/0`), so `getPortalClasses` keeps them and `className` set to the first; option names start `["About CLUE", <class 1>, <class 2>]` and `list-item-about-clue` has the `bottomBorder` class; choosing About CLUE calls `onShowAbout` and leaves class 1 with `aria-selected="true"`. Reopening focuses class 1. A second test with no offerings: the header is not `disabled` and the only option is About CLUE. A third with `standaloneAuthUser` set: order is About CLUE, Copy Shareable Link, Log Out, then classes.

## Notes for the operator

No Firebase functions, rules or indexes change, so no Deploy timing callout. No authorable unit `config` changes, so `docs/unit-configuration.md` is untouched. Run `npm run lint:build` and `npm run check:types` before each commit.

## Open Questions

### RESOLVED: Judgment call: `useCustomModal` or a bespoke `react-modal` component like `GroupManagementModal`?
**Context**: R14 wants CLUE's chrome; R22 wants room for a second view with its own title.
**Options considered**:
- A) `useCustomModal`
- B) A component on `react-modal` that copies the `custom-modal` markup, as `GroupManagementModal` does
**Decision**: A. It is the shared source of the chrome and a11y behavior, verified against the real trigger, and its dependencies argument re-renders the title for CLUE-804's view switch (verified). B would be a second copy of the chrome to keep in step.

### RESOLVED: Judgment call: Fix `CustomSelect` for every action item, or only About CLUE?
**Context**: R3 covers About CLUE and, by the requirements' extension, Log Out and Copy Shareable Link.
**Options considered**:
- A) An `isAction` flag, set on all three
- B) Special-case About CLUE in the containers (e.g. re-render to reset selection)
**Decision**: A. One flag in the component that owns the selection, rather than workarounds in each caller.

### RESOLVED: Judgment call: Straight or curly apostrophe in "you're"?
**Context**: The Jira copy has a straight apostrophe; CODAP's approved string has a curly one; `react/no-unescaped-entities` rejects a bare `'` in JSX.
**Options considered**:
- A) `’`, as CODAP ships it
- B) `&apos;`, matching the Jira text byte for byte
**Decision**: A. It is the approved CODAP wording the story says to match, and it renders as the intended punctuation. The R10 comparison in the test uses `’`.

## Self-Review

Roles: Senior Engineer, Test Writer, Commit Reviewer, WCAG Accessibility Expert, Operator.

The plan's code was assembled for real in the worktree (every block above, with an SVG standing in for the logo, which was not yet chosen), type-checked, linted with `.eslintrc.build.js`, and exercised by throwaway tests modeled on the ones named in each step, then removed. Results: the planned source files lint clean; the R10 paragraph comparison, the seven link targets and attributes, the version line, the student menu's order and divider, and focus return to `user-header` after Escape all held; the existing `custom-select`, `use-custom-modal`, `student-menu-container`, group management and Timeline suites (295 tests) still passed with the changes in place. With the `isAction` guard removed from `handleSelect`, the class-menu test saw About CLUE take `aria-selected` and next-open focus, so that test catches the regression it is there for.

### Test Writer

#### RESOLVED: The class-menu fixture as first written could not produce any class options
`ClassMenuContainer` keeps only offerings whose `problemPath` matches `stores.problemPath`, which is `NULL/0/0` under `specStores()`, and `UserModel` has no setter for offerings. A prototype fixture with empty unit and ordinal rendered only About CLUE, so the "class 1 stays selected" assertion would have had nothing to check. The test description now names the snapshot form and the matching `unitCode` / `problemOrdinal`.

### Responsive Layout Reviewer

#### RESOLVED (self-review round 1): The modal could overflow a short viewport
`.custom-modal` sets no `max-height` or `overflow`, and react-modal's default overlay is a fixed box that does not scroll, so the roughly 650 px About modal centered by `translate(-50%, -50%)` would lose its title bar and footer in a short iframe or small laptop window. `about-dialog.scss` now caps the modal at `100vh - 40px` and scrolls `.modal-content` (as `GroupManagementModal` caps itself at 80vh); R12 states the behavior. The links inside keep the scroll region keyboard-reachable.

### Implementer (cold read)

#### RESOLVED (self-review round 2): Focus-return assertions in the `useAboutDialog` harness could not pass as described
Running the harness as written, with the trigger clicked by `fireEvent.click`, left focus on `body` after Close, × and Escape, because nothing focused the trigger before the dialog opened. With `trigger.focus()` first, all three returned focus to it. The test description now says so.

#### RESOLVED (self-review round 2): R23's divider check was missing from the class-menu test
R23 asks both containers' tests to check the divider under About CLUE; only the student-menu test did. The class-menu test now asserts the `bottomBorder` class too.

### PR Code Reviewer

#### RESOLVED (self-review round 3): The link-target test could pass by construction
The test description did not say where the expected URLs come from; a table built from the exported `k*` constants would only prove each link uses its constant, not that the constant matches R10 and R11. The test now lists the URLs as literals.

### Spec Editor

#### RESOLVED (self-review round 3): Process references and a stale icon note
"Stage 4" references meant nothing outside the speccing run and now read as plain verification notes. requirements.md's icon note still offered a copy and a title-bar icon; it now matches the plan (moved file, menu item only).

