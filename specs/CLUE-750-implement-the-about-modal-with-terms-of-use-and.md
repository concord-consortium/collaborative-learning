# About CLUE Modal with Terms of Use and Licensing

**Jira**: https://concord-consortium.atlassian.net/browse/CLUE-750

**Status**: **Closed**

## Overview

Add an "About CLUE" item to the user-name dropdown in CLUE's header that opens a modal showing CLUE's identity, version and build, copyright, and its license and Terms of Use language. CLUE has no licensing or Terms of Use language anywhere today.

Concord is adding Terms of Use and licensing language across its hosted apps. CODAP already shipped an About dialog for this (CODAP-1595, codap#2758), and CLUE-750 gives CLUE the equivalent: one place, reachable by every user type, that states CLUE is MIT-licensed open source and that use of the hosted site is governed by Concord's Terms of Use, with links to the terms, the licensing page and the source. The design story (CLUE-749) was pulled, so the mockup linked from the Jira story, the Zeplin screen and CODAP's dialog are the design. The open-source libraries list is a follow-on (CLUE-804), which this modal leaves room for without building.

## Requirements

### Entry point

- R1. The user-name dropdown gets an **About CLUE** item, first in the list, with an info icon, followed by a divider. Everything already in the menu follows the divider unchanged ("Log Out" for students; "Copy Shareable Link" / "Log Out" and the class list for teachers and researchers).
- R2. The item is present for students, teachers and researchers, in both header variants, standalone and portal-launched, top-level and in an iframe: every case where the user control renders.
- R3. About CLUE is an action, never a selection. Choosing it opens the modal and changes nothing else about the menu: the header text stays the user's name and class, and the option marked selected (the current class, for teachers) stays selected, so reopening the menu focuses that option. About CLUE is never marked `aria-selected` and never supplies the header text, including on first render when no option is selected. The menus' other action items, "Log Out" and "Copy Shareable Link", get the same treatment (Doug confirmed this addition to the story's scope).
- R4. The item is reachable and activatable by keyboard through the dropdown's existing pattern (open with Enter, Space or ArrowDown; move with arrows; choose with Enter or Space).

### Modal content (top to bottom, per the mockup)

- R5. Title bar: "About CLUE".
- R6. The CLUE block logo (colored C-L-U-E tiles) with "a product of", the Concord lightbulb and "The Concord Consortium" directly below it, as one image 210 px wide named "CLUE, a product of The Concord Consortium" (`role="img"` and `aria-label`).
- R7. The tagline "Collaborative Learning User Environment".
- R8. `Version {version} · build {build}`, where `{version}` is `stores.appVersion` and `{build}` is the first 7 characters of `gitInfo.gitSha`, or the whole value when it is shorter (so a local build reads `build dev`). If `gitSha` is empty or missing, the line is `Version {version}` alone. The line is selectable and copyable despite the app-wide `user-select: none`.
- R9. `© {year} The Concord Consortium, Inc.`, with `{year}` the current year from the browser clock when the modal renders.
- R10. A divider, then a **License & Terms of Use** heading (an `h2`) and the two paragraphs below, verbatim (the CODAP-approved wording with CLUE's name and hosted URL, including CODAP's curly apostrophe in "you’re"):

  > **CLUE is free, open-source software.** The CLUE source code is released under the MIT License, so you’re welcome to use, modify, and build on it.
  >
  > **Your use of CLUE at collaborative-learning.concord.org** is governed by our Terms of Use. The hosted version is free for non-commercial use; commercial use requires a separate written agreement. For more information, visit concord.org/licensing or contact licensing@concord.org.

  Links: "MIT License" → `https://github.com/concord-consortium/collaborative-learning/blob/master/LICENSE`; "Terms of Use" → `https://concord.org/terms-of-use/`; "concord.org/licensing" → `https://concord.org/licensing`; "licensing@concord.org" → `mailto:licensing@concord.org`.
- R11. A divider, then a row of quick links: "Terms of Use" (`https://concord.org/terms-of-use/`), "Licensing details" (`https://concord.org/licensing`), "Source on GitHub" (`https://github.com/concord-consortium/collaborative-learning`), each followed by a decorative ↗.
- R12. A footer with one **Close** button in CLUE's dialog button style. On a viewport too short for the whole modal, the modal fits the viewport and its content scrolls, so the title bar, × and Close stay reachable.
- R13. No "Open-source libraries & acknowledgements" button or placeholder; CLUE-804 adds it.

### Chrome and links

- R14. The modal uses CLUE's existing dialog chrome (gray title bar, teal border, close ×, Lato, CLUE's modal buttons and their existing hover and pressed states), not CODAP's.
- R15. External links (every link but the mailto) open in a new tab with `target="_blank"` and `rel="noopener noreferrer"`, and carry visually hidden text "(opens in a new tab)" for screen readers. The ↗ is `aria-hidden`. The story says `rel="noopener"`; `noreferrer` is added to match CODAP and the stream's geo apps.
- R16. Every link is underlined at rest, in the body paragraphs and the quick links alike, as the mockup's screen 1 shows.

### Accessibility and behavior

- R17. The modal is `role="dialog"` with `aria-modal="true"`, named by its title via `aria-labelledby`.
- R18. Focus moves into the modal when it opens and is trapped there while it is open.
- R19. The modal closes on ×, on Close, and on Escape. Clicking the overlay does not close it. Enter on a focused link follows the link and leaves the modal open.
- R20. On close, focus returns to the user-menu trigger.
- R21. The modal works the same for every user type and launch context in R2.

### Extensibility for CLUE-804

- R22. The modal's content is one component whose structure lets CLUE-804 add a second view (the libraries list, with its own title and a Back control) and the button that opens it, without changing how the modal is opened. No second view, view state or libraries data is built here.

### Verification

- R23. Automated tests cover the menu item in both containers (present, first, followed by the divider, not selectable as a value) and the modal (content, link targets and attributes, close paths, focus return). Iframe behavior is checked in Activity Player: a hand-written activity whose interactives load a local build in demo mode, as a student and as a teacher, served locally and opened with `?activity=<url>`. About CLUE is first in each menu, opens by keyboard with focus moved in and kept in, and closes by Escape, Close and × with focus back on the menu button. A portal launch loads the same CLUE URL, so it needs no separate check.

## Technical Notes

- The header's user control is a `CustomSelect` (`src/clue/components/custom-select.tsx`) filled by `StudentMenuContainer` (students, and teachers when `showClassSwitcher` is off) or `ClassMenuContainer` (teachers with the class switcher, and researchers). Both are class components, so `ClueAppHeaderComponent` calls `useAboutDialog()` and passes the opener down as `onShowAbout`.
- `CustomSelect` gained `isAction` on `ICustomDropdownItem`: an action item runs its `onClick` but is never the initial selection and never becomes the selection when chosen.
- The modal is a `useCustomModal` dialog, which supplies CLUE's chrome, `role="dialog"`, `aria-modal`, focus trapping, Escape and focus return. `useCustomModal`'s Enter handler now returns early for a focused link, as it already did for buttons.
- For CLUE-804: add a `view` state in `useAboutDialog`, derive `title` from it, pass `view` and a setter through `contentProps`, and list `[view]` as `useCustomModal`'s dependencies; a `useCustomModal` title re-renders while open when its dependencies change.
- Logo: the "CLUE, a product of The Concord Consortium" lockup Kiley Brown supplied (105 × 80.36, all lettering as paths, no live text), at `src/assets/clue-product-of-concord-logo.nosvgo.svg`, displayed 210 px wide with its height from the viewBox. The export's `<style>` block of `.cls-N` classes was inlined onto each element, because an inline SVG's `<style>` applies to the whole page and Illustrator exports elsewhere reuse those class names. The `.nosvgo` suffix skips the build's svgo pass: its `mergePaths` and `convertPathData` plugins visibly change the small lettering, and skipping it also keeps the viewBox. The repo's SVGR loader turns every `.svg` imported from TypeScript into a React component, so the logo renders as an inline SVG named with `role="img"` and `aria-label` rather than an `img` with `alt`.
- Info icon: moved from `src/plugins/timeline/assets/` to `src/assets/icons/info-icon.svg` so core code does not import from a plugin. The build's svgo pass strips its `viewBox`, so the menu passes `viewBox="0 0 24 24"` as a prop to scale it to 16 px instead of cropping it (as `TitleIcon` does in `document-file-menu.tsx`).
- User menu styling follows the Zeplin screen (`clue-app-header.scss`, inside `.user`): the list is at least as wide as the header and rounded on all four corners; the icon is the teal outline glyph with its light fill turned off, drawn white while the item is pressed; the student menu has no check column, so the icon sits 12 px from the edge and "Log Out" aligns with the About label. The class menu keeps its check column to mark the current class.
- Colors come from `vars.scss`: `$workspace-teal-dark-1` is the mockup's link color exactly (#0481a0); hover and gray text use the nearest palette entries. Measured mockup values: dialog 584 px wide including its 2 px border, with 28 px side padding; tagline 14 px; version pill 13 px text, 22 px tall, with a 12 px radius; body paragraphs 15 px, line-height 1.5; section heading 13 px; quick links 13 px with a 22 px gap.
- Test harness notes: react-modal's Escape handler checks `keyCode`, so tests send `fireEvent.keyDown(..., { keyCode: 27 })`. Tests render inside a `.app` wrapper and call `Modal.setAppElement(".app")` after render, so react-modal does not hide the dialog itself from role queries, and focus the trigger before clicking it so focus return has a target.
- In demo and QA modes a teacher or researcher has no portal class offerings, so the class menu, previously disabled there, now opens with About CLUE alone. The teacher dashboard Cypress spec checks for that instead of expecting no list.
- No Firebase functions, rules or indexes change, so no Deploy timing callout; no authorable unit `config` changes.

## Out of Scope

- The open-source libraries and acknowledgements view, its build-time data, and the button that opens it (CLUE-804).
- Usage tracking for commercial use.
- Localizing the legal copy, or routing it through CLUE's `translate` term overrides.
- A first-launch welcome dialog.
- About for the standalone doc editor (`/editor/`) and authoring entry points, which have no CLUE header.
- About before standalone login completes (the user control is not shown then).
- Changes to the shared modal button styles: the ticket asks for CLUE's dialog styling, which the modal uses unchanged.

## Decisions

### What does `{build}` show, given CLUE has no build number?
**Context**: CODAP reads a `build_number.json` that CLUE does not have. CLUE's build metadata is `version.json` (git sha, branch, tag, date), written by CI.
**Options considered**:
- A) Short git sha (7 chars) from `gitInfo.gitSha`
- B) The git tag
- C) Add a build-number file and CI step like CODAP's

**Decision**: A. The sha identifies the exact commit on every build, including branch previews where there is no tag; the tag repeats the version on releases. C adds CI work outside a 3-point story. Locally it reads `build dev`, which is accurate.

---

### Show a disabled or placeholder libraries button now?
**Context**: The mockup draws the button with a "follow-on story" badge.
**Options considered**:
- A) Omit it; CLUE-804 adds it
- B) Render it disabled

**Decision**: A. A dead control ships to users and is announced by screen readers. The mockup labels it as belonging to the follow-on.

---

### Copyright year at build time or run time?
**Context**: The Jira story allows either.
**Options considered**:
- A) Run time, `new Date().getFullYear()`
- B) Build time, injected by webpack

**Decision**: A, as CODAP does. No build plumbing, and a long-lived deploy rolls over on January 1.

---

### Teacher and researcher menus have no "Log Out" when launched from the portal
**Context**: The story describes the menu as holding only "Log Out", which is true of `StudentMenuContainer`. A portal-launched teacher or researcher sees the class switcher list with no "Log Out".
**Options considered**:
- A) About CLUE, divider, then the existing items unchanged (class list for portal teachers)
- B) Also add "Log Out" for portal teachers and researchers

**Decision**: A. The story asks for an About entry, not for changes to who can log out where; `ClassMenuContainer` deliberately adds "Log Out" only for standalone-authenticated users (portal users sign out through the portal).

---

### Should opening About log an event?
**Context**: CLUE logs many UI actions through `Logger` for research. The story does not mention logging.
**Options considered**:
- A) No log event
- B) Log an event when the modal opens

**Decision**: A. Comparable read-only dialogs (the Timeline info modal, the group management modal's open) log nothing, and viewing licensing text carries no learning signal. Adding a `LogEventName` later is a one-line change if research asks.

---

### The CLUE block logo file
**Context**: R6 needs the asset; the story prefers SVG.
**Options considered**:
- A) Export from the Zeplin link in the story
- B) Build with a placeholder and swap the file before Kiley's review

**Decision**: A. The SVG export's letters were live text in a font CLUE does not load, so the dialog first shipped the 4x PNG, then Michael Tirenin's outlined SVG. At acceptance review Kiley Brown asked for the Concord lightbulb and supplied an outlined lockup with "a product of The Concord Consortium" below the logo, which replaced both the logo and the HTML product line. She chose 210 px wide, where the lockup's product line matches the 11 px text it replaced, over keeping the mockup's 135 px logo (7 px text) or drawing the line wider than the logo.

---

### Action items behave as selectable values in `CustomSelect`
**Context**: A throwaway render of `CustomSelect` with About CLUE first showed it marked `aria-selected` on first render, used as the header text when `title` is empty, and taking over the selection (and next-open focus) after being chosen.
**Options considered**:
- A) Require About CLUE (and the other action items) to be actions that never become the selection or the header text
- B) Leave `CustomSelect` as it is

**Decision**: A, recorded as R3.

---

### `useCustomModal` or a bespoke `react-modal` component like `GroupManagementModal`?
**Context**: R14 wants CLUE's chrome; R22 wants room for a second view with its own title.
**Options considered**:
- A) `useCustomModal`
- B) A component on `react-modal` that copies the `custom-modal` markup, as `GroupManagementModal` does

**Decision**: A. It is the shared source of the chrome and a11y behavior, verified against the real trigger, and its dependencies argument re-renders the title for CLUE-804's view switch. B would be a second copy of the chrome to keep in step.

---

### Fix `CustomSelect` for every action item, or only About CLUE?
**Context**: R3 covers About CLUE and, by extension, Log Out and Copy Shareable Link.
**Options considered**:
- A) An `isAction` flag, set on all three
- B) Special-case About CLUE in the containers (e.g. re-render to reset selection)

**Decision**: A. One flag in the component that owns the selection, rather than workarounds in each caller.

---

### Straight or curly apostrophe in "you're"?
**Context**: The Jira copy has a straight apostrophe; CODAP's approved string has a curly one; `react/no-unescaped-entities` rejects a bare `'` in JSX.
**Options considered**:
- A) `’`, as CODAP ships it
- B) `&apos;`, matching the Jira text byte for byte

**Decision**: A. It is the approved CODAP wording the story says to match, and it renders as the intended punctuation.

---

### Menu divider style
**Context**: The mockup draws a solid 1 px #d8d8d8 divider under About CLUE; the menu already uses `bottomBorder`, a dashed `$workspace-teal-light-5` rule, to separate "Log Out" from the class list for standalone teachers.
**Options considered**:
- A) The existing `bottomBorder` style
- B) The mockup's solid gray line

**Decision**: A (Doug's call), per R14, so the menu keeps one divider style.

---

### The modal could overflow a short viewport
**Context**: `.custom-modal` sets no `max-height` or `overflow`, and react-modal's overlay does not scroll, so the roughly 650 px modal would lose its title bar and footer in a short iframe or small laptop window.
**Options considered**:
- A) Cap the modal at `100vh - 40px` and scroll `.modal-content`
- B) Leave the shared modal behavior as is

**Decision**: A, in `about-dialog.scss` (as `GroupManagementModal` caps itself at 80vh); R12 states the behavior.

---

### Shared modal button hover and pressed states
**Context**: The default Close button shows no visible change on hover, and the × has no pressed state; both come from the shared `custom-modal.scss`, which every CLUE dialog uses and this branch does not touch.
**Options considered**:
- A) Leave the shared styles unchanged
- B) Change the shared styles for every dialog
- C) Override them for the About dialog only

**Decision**: A (Doug). The ticket asks for CLUE's dialog styling, which is what the modal already uses.

---

### Link-target tests could pass by construction
**Context**: A link table built from the exported `k*` URL constants would only prove each link uses its constant, not that the constant matches R10 and R11.
**Options considered**:
- A) Write the expected URLs as literals in the test
- B) Reuse the exported constants

**Decision**: A, with the table length asserted against the rendered links first.
