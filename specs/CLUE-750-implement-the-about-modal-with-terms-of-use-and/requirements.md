# About CLUE Modal with Terms of Use and Licensing

**Jira**: https://concord-consortium.atlassian.net/browse/CLUE-750
**Repo**: https://github.com/concord-consortium/collaborative-learning
**Implementation Spec**: [implementation.md](implementation.md)
**Status**: **In Development**

## Overview

Add an "About CLUE" item to the user-name dropdown in CLUE's header that opens a modal showing CLUE's identity, version and build, copyright, and its license and Terms of Use language. CLUE has no licensing or Terms of Use language anywhere today.

## Project Owner Overview

Concord is adding Terms of Use and licensing language across its hosted apps (the terms-of-use stream). CODAP already shipped an About dialog for this (CODAP-1595, codap#2758), and CLUE-750 gives CLUE the equivalent: one place, reachable by every user type, that states CLUE is MIT-licensed open source and that use of the hosted site is governed by Concord's Terms of Use, with links to the terms, the licensing page and the source.

The design story (CLUE-749) was pulled, so the mockup linked from the Jira story and CODAP's dialog are the design. The open-source libraries list is a follow-on (CLUE-804), which this modal must leave room for without building. Kiley Brown reviews the deployed branch before merge.

## Background

- The header's upper-right user control is a `CustomSelect` dropdown (`src/clue/components/custom-select.tsx`). Two containers fill it:
  - `StudentMenuContainer` (`src/components/student-menu-container.tsx`): students, and teachers when `showClassSwitcher` is off. Holds only "Log Out".
  - `ClassMenuContainer` (`src/components/class-menu-container.tsx`): teachers with `showClassSwitcher` on, and researchers. Holds the class switcher list, preceded by "Copy Shareable Link" and "Log Out" only for standalone-authenticated users. A portal-launched teacher or researcher has no "Log Out" in it today.
- The header (`src/clue/components/clue-app-header.tsx`) is the same component whether CLUE runs standalone, from the portal, or inside an activity iframe. The user control is hidden only while standalone authentication is in progress (`showUserInfo`), when the app shows the auth screens instead.
- The dropdown follows the listbox pattern from `useDropdown` (`@concord-consortium/accessibility-tools`): trigger is `role="button"` with `aria-haspopup="listbox"`, items are `role="option"`. Choosing an item by click, Enter or Space runs its `onClick` and then returns focus to the trigger synchronously.
- CLUE's dialog chrome is the gray title bar, 2px teal border and close × shared by `useCustomModal` (`src/hooks/use-custom-modal.tsx`, `custom-modal.scss`) and the Join Group dialog (`GroupManagementModal`). `useCustomModal` is built on `react-modal`, which supplies `role="dialog"`, focus trapping and focus return to the element focused when the dialog opened. The Timeline tile's info modal (`src/plugins/timeline/components/timeline-info-button.tsx`) is an existing read-only info dialog on `useCustomModal`.
- Build metadata: `stores.appVersion` is `package.json`'s version, already shown in the header as `CLUE v{appVersion}`. `stores.gitInfo` comes from `version.json`, which CI's build overwrites (`npm run build:version`, `scripts/write-version.js`) with `gitSha`, `branch`, `tag` and `date`; the committed placeholder holds `"dev"` for each.
- `LICENSE` at the repo root is the MIT License (verified), so the Jira copy applies unchanged.
- `body` sets `user-select: none` (`src/index.scss`), so any text meant to be copyable must opt back in.

## Requirements

### Entry point

- R1. The user-name dropdown gets an **About CLUE** item, first in the list, with an info icon, followed by a divider. Everything already in the menu follows the divider unchanged ("Log Out" for students; "Copy Shareable Link" / "Log Out" and the class list for teachers and researchers).
- R2. The item is present for students, teachers and researchers, in both header variants, standalone and portal-launched, top-level and in an iframe: every case where the user control renders.
- R3. About CLUE is an action, never a selection. Choosing it opens the modal and changes nothing else about the menu: the header text stays the user's name and class, and the option marked selected (the current class, for teachers) stays selected, so reopening the menu focuses that option. About CLUE is never marked `aria-selected` and never supplies the header text, including on first render when no option is selected. The menus' other action items, "Log Out" and "Copy Shareable Link", get the same treatment: they share the mechanism, and leaving them as selectable values would let Copy Shareable Link still take the selection from the current class in the same menu. Doug confirmed this addition to the story's scope. (Today `CustomSelect` treats every item as a selectable value: it marks the first item selected on first render when none is, falls back to the selected item's text when `title` is empty, and moves the selection onto any chosen item. All three were confirmed with throwaway tests.)
- R4. The item is reachable and activatable by keyboard through the dropdown's existing pattern (open with Enter, Space or ArrowDown; move with arrows; choose with Enter or Space).

### Modal content (top to bottom, per the mockup)

- R5. Title bar: "About CLUE".
- R6. The CLUE block logo (colored C-L-U-E tiles) at the mockup's 3:2 proportions (135 × 90 px in the mockup), as an `img` with `alt="CLUE"`, with "a product of The Concord Consortium" directly below it.
- R7. The tagline "Collaborative Learning User Environment".
- R8. `Version {version} · build {build}`, where `{version}` is `stores.appVersion` and `{build}` is the first 7 characters of `gitInfo.gitSha`, or the whole value when it is shorter (so a local build reads `build dev`). If `gitSha` is empty or missing, the line is `Version {version}` alone. The line is selectable and copyable despite the app-wide `user-select: none`.
- R9. `© {year} The Concord Consortium, Inc.`, with `{year}` the current year from the browser clock when the modal renders.
- R10. A divider, then a **License & Terms of Use** heading and the two paragraphs below, verbatim (the CODAP-approved wording with CLUE's name and hosted URL, including CODAP's curly apostrophe in "you’re", where the story's text has a straight one):

  > **CLUE is free, open-source software.** The CLUE source code is released under the MIT License, so you’re welcome to use, modify, and build on it.
  >
  > **Your use of CLUE at collaborative-learning.concord.org** is governed by our Terms of Use. The hosted version is free for non-commercial use; commercial use requires a separate written agreement. For more information, visit concord.org/licensing or contact licensing@concord.org.

  The heading is marked up as a heading element (`h2`; the dialog title in CLUE's chrome is not itself a heading). Links: "MIT License" → `https://github.com/concord-consortium/collaborative-learning/blob/master/LICENSE`; "Terms of Use" → `https://concord.org/terms-of-use/`; "concord.org/licensing" → `https://concord.org/licensing`; "licensing@concord.org" → `mailto:licensing@concord.org`.
- R11. A divider, then a row of quick links: "Terms of Use" (`https://concord.org/terms-of-use/`), "Licensing details" (`https://concord.org/licensing`), "Source on GitHub" (`https://github.com/concord-consortium/collaborative-learning`), each followed by a decorative ↗.
- R12. A footer with one **Close** button in CLUE's dialog button style. On a viewport too short for the whole modal (an iframe embed, a small laptop), the modal fits the viewport and its content scrolls, so the title bar, × and Close stay reachable.
- R13. No "Open-source libraries & acknowledgements" button or placeholder. The mockup shows one tagged "follow-on story"; CLUE-804 adds it.

### Chrome and links

- R14. The modal uses CLUE's existing dialog chrome (gray title bar, teal border, close ×, Lato, CLUE's modal buttons), not CODAP's.
- R15. External links (every link but the mailto) open in a new tab with `target="_blank"` and `rel="noopener noreferrer"`, and carry visually hidden text "(opens in a new tab)" for screen readers, as CODAP's `ExternalLink` does. The ↗ is `aria-hidden`. The story says `rel="noopener"`; `noreferrer` is added to match CODAP and the stream's geo apps.
- R16. Links inside the body paragraphs are underlined at rest. Quick links follow the mockup (not underlined at rest).

### Accessibility and behavior

- R17. The modal is `role="dialog"` with `aria-modal="true"`, named by its title via `aria-labelledby`.
- R18. Focus moves into the modal when it opens and is trapped there while it is open.
- R19. The modal closes on ×, on Close, and on Escape. Clicking the overlay does not close it (CLUE's dialog convention). Enter on a focused link follows the link and leaves the modal open.
- R20. On close, focus returns to the user-menu trigger.
- R21. The modal works the same for every user type and launch context in R2.

### Extensibility for CLUE-804

- R22. The modal's content is one component whose structure lets CLUE-804 add a second view (the libraries list, with its own title and a Back control, as in the mockup's screen 3 and CODAP's dialog) and the button that opens it, without changing how the modal is opened. No second view, view state or libraries data is built here.

### Verification

- R23. Automated tests cover the menu item in both containers (present, first, followed by the divider, not selectable as a value) and the modal (content, link targets and attributes, close paths, focus return). Portal-launched and iframe behavior is checked by hand on the branch deploy, as part of Kiley's review. That needs a portal offering whose launch URL points at the branch preview; the deploy drops the ticket prefix from the folder name (see "Branch preview URLs" in `CLAUDE.md`).

## Technical Notes

- Mockup: the Jira story's artifact link, screens 1 and 2. Measured values from its source: dialog 580 px wide; logo 135 × 90; "a product of" 11 px #5c5c5c; tagline 14 px; version pill 13 px on #eeeeee, 12 px radius; body paragraphs 15 px, line-height 1.5; section heading 13 px #5c5c5c; quick links 13 px with 22 px gap; links #0481a0, hover #035e75. Menu: About item has a 16 px info icon, 1 px #d8d8d8 divider below it, and "Log Out" indented to align with the About label.
- CODAP reference: `v3/src/components/about-dialog/about-dialog.tsx`, `about-dialog-constants.ts` and `common/external-link.tsx` in codap (merged codap#2758). CODAP's copyright reads "1996–{year}"; CLUE uses the current year only, per the Jira story.
- The menu item's info icon is `src/plugins/timeline/assets/info-icon.svg` (CLUE's info glyph in its teal palette), moved to `src/assets/icons/` so core code does not import from a plugin. The dialog's title bar has no icon, as in the mockup.
- `CustomSelect` already supports `itemIcon` / `showItemIcons`, `hideItemCheck` and `bottomBorder` (the divider), so the menu change needs no new item props except for R3.
- In demo and QA modes a teacher or researcher has no portal class offerings, so `ClassMenuContainer` passes an empty list and `CustomSelect` renders disabled today. With About CLUE added, the menu opens for them with About CLUE alone, which R2 wants.
- `ClassMenuContainer` and `StudentMenuContainer` are class components; `useCustomModal` is a hook, so the modal opener lives in a function component.
- Production URL `collaborative-learning.concord.org` is the hosted site named in the copy. Branch previews live under `/branch/<name>/` on the same host.
- Verified by throwaway Jest tests against the real `CustomSelect`, `useCustomModal` and `react-modal`: opening a `useCustomModal` dialog from a dropdown item, by keyboard or mouse, gives `role="dialog"`, `aria-modal="true"`, the title as its name and focus inside; closing it by Escape, Close or × returns focus to the dropdown trigger. One defect surfaced: `useCustomModal` routes Enter on anything but a button, select or textarea to the default button, so with Close as the default button, Enter on a focused link closed the dialog and cancelled the navigation. R19's Enter clause covers it.
- In Jest, Escape must be sent with `fireEvent.keyDown(..., { keyCode: 27 })`: react-modal checks `keyCode`, which user-event v14 does not set (see `group-management-modal.test.tsx`).
- Logo asset: the Jira story's Zeplin link points at the "CLUE Logo Small" layer (105 × 70). Its SVG export draws the letters as live `<text>` in the Museo font, which CLUE does not load, so the browser would substitute another font; its PNG exports are rasterized with Museo. CLUE uses the 4x PNG (420 × 280) displayed at 135 × 90, which stays sharp on 2x and 3x screens.

## Out of Scope

- The open-source libraries and acknowledgements view, its build-time data, and the button that opens it (CLUE-804).
- Usage tracking for commercial use.
- Localizing the legal copy, or routing it through CLUE's `translate` term overrides.
- A first-launch welcome dialog (CODAP has one; not requested).
- About for the standalone doc editor (`/editor/`) and authoring entry points, which have no CLUE header.
- About before standalone login completes (the user control is not shown then).

## Open Questions

### RESOLVED: Judgment call: What does `{build}` show, given CLUE has no build number?
**Context**: CODAP reads a `build_number.json` that CLUE does not have. CLUE's build metadata is `version.json` (git sha, branch, tag, date), written by CI.
**Options considered**:
- A) Short git sha (7 chars) from `gitInfo.gitSha`
- B) The git tag
- C) Add a build-number file and CI step like CODAP's
**Decision**: A. The sha identifies the exact commit on every build, including branch previews where there is no tag; the tag repeats the version on releases. C adds CI work outside a 3-point story. Locally it reads `build dev`, which is accurate.

### RESOLVED: Judgment call: Show a disabled or placeholder libraries button now?
**Context**: The mockup draws the button with a "follow-on story" badge.
**Options considered**:
- A) Omit it; CLUE-804 adds it
- B) Render it disabled
**Decision**: A. A dead control ships to users and is announced by screen readers. The mockup labels it as belonging to the follow-on.

### RESOLVED: Judgment call: Copyright year at build time or run time?
**Context**: The Jira story allows either.
**Options considered**:
- A) Run time, `new Date().getFullYear()`
- B) Build time, injected by webpack
**Decision**: A, as CODAP does. No build plumbing, and a long-lived deploy rolls over on January 1.

### RESOLVED: Low confidence: Teacher and researcher menus have no "Log Out" when launched from the portal
**Context**: The Jira story describes the menu as holding only "Log Out", which is true of `StudentMenuContainer`. A portal-launched teacher or researcher sees the class switcher list in `ClassMenuContainer` with no "Log Out". R1 puts About CLUE and its divider above whatever the menu holds.
**Options considered**:
- A) About CLUE, divider, then the existing items unchanged (class list for portal teachers)
- B) Also add "Log Out" for portal teachers and researchers
**Decision**: A. The story asks for an About entry, not for changes to who can log out where; `ClassMenuContainer` deliberately adds "Log Out" only for standalone-authenticated users (portal users sign out through the portal). The divider then separates About CLUE from the class list, which still reads correctly.

### RESOLVED: Low confidence: Should opening About log an event?
**Context**: CLUE logs many UI actions through `Logger` for research. The story does not mention logging.
**Options considered**:
- A) No log event
- B) Log an event when the modal opens
**Decision**: A. Comparable read-only dialogs (the Timeline info modal, the group management modal's open) log nothing, and viewing licensing text carries no learning signal. Adding a `LogEventName` later is a one-line change if research asks.

### RESOLVED: The CLUE block logo file
**Context**: R6 needs the asset, and the Zeplin MCP server was not connected during speccing.
**Options considered**:
- A) Doug downloads the SVG export from the Zeplin link in the story and adds it to the branch (or hands over the file)
- B) Build with a placeholder and swap the file before Kiley's review

**Decision**: A (Doug). The file was exported from Zeplin's "CLUE Logo Small" layer during speccing. The story prefers SVG, but that export's letters are live text in a font CLUE does not load, so Doug chose the 4x PNG over the SVG and over asking the designer for an outlined SVG.

## Self-Review

Roles: Senior Engineer, WCAG Accessibility Expert, QA Engineer, Product Manager (Kiley's review), Teacher.

### Senior Engineer

#### RESOLVED: Action items behave as selectable values in `CustomSelect`
A throwaway render of `CustomSelect` with About CLUE first showed it marked `aria-selected` on first render, used as the header text when `title` is empty, and taking over the selection (and next-open focus) after being chosen. R3 now requires About CLUE to be an action that never becomes the selection or the header text.

#### RESOLVED: Demo-mode teacher and researcher menus are disabled today
`ClassMenuContainer` returns no items without portal offerings, which disables the dropdown. Recorded in Technical Notes so the newly enabled menu is expected, not a regression.

### WCAG Accessibility Expert

#### RESOLVED: Section heading semantics
R10 called "License & Terms of Use" a heading without saying it is one in markup; CODAP uses an `h3`. R10 now requires heading markup.

### QA Engineer

#### RESOLVED: No stated split between automated and manual checks
The acceptance criteria name portal launches, which unit tests and the demo-mode Cypress setup cannot reach. R23 states what automated tests cover and that portal and iframe behavior is checked on the branch deploy.

### Acceptance Reviewer (Kiley, on the branch deploy)

#### RESOLVED (self-review round 4): Differences from the story's text were not called out where Kiley would compare
R10 called the copy verbatim while quoting the story's straight apostrophe, though the plan and its test use CODAP's curly one; R15 did not say `noreferrer` goes beyond the story's `rel="noopener"`. Both now say so. R23's manual portal check now says how to reach the branch build from the portal.
