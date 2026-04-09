# Link Editor "Display as" Radio Buttons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "Display as: Link / Button" radio buttons to the Link Editor modal, with logging, updated styling (Lato font, teal Save button, 300×300px size), and tests.

**Architecture:** Extend the existing `useLinkDialog` hook and `LinkDialogContent` component to include a `displayMode` state and radio buttons. Style changes go in the dialog's SCSS and the shared `custom-modal.scss`. A new `LogEventName` is added for analytics. Tests verify UI behavior via React Testing Library.

**Tech Stack:** React 17, TypeScript 4.9, `useCustomModal` hook, `react-modal`, SCSS, Jest + React Testing Library

---

## Files

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `src/components/tiles/text/dialog/use-link-dialog.tsx` | Add `displayMode` state, radio buttons, pass to save handler |
| Modify | `src/components/tiles/text/dialog/use-link-dialog.scss` | Radio button layout, Lato font, 300×300 modal size |
| Modify | `src/components/tiles/text/toolbar/link-button.tsx` | Pass `tileId` to `useLinkDialog` for logging |
| Modify | `src/hooks/custom-modal.scss` | Lato font on buttons, teal default color for Save |
| Modify | `src/lib/logger-types.ts` | Add `TEXT_LINK_DISPLAY_CHANGE` enum value |
| Create | `src/components/tiles/text/dialog/use-link-dialog.test.tsx` | Tests for radio buttons, defaults, logging, modal size |

---

### Task 1: Add LogEventName

**Files:**
- Modify: `src/lib/logger-types.ts:40`

- [ ] **Step 1: Add the new enum value**

After line 40 (`TEXT_TOOL_CHANGE,`), add:

```typescript
  TEXT_LINK_DISPLAY_CHANGE,
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/logger-types.ts
git commit -m "feat(logger): add TEXT_LINK_DISPLAY_CHANGE event type"
```

---

### Task 2: Add displayMode state and radio buttons to LinkDialogContent

**Files:**
- Modify: `src/components/tiles/text/dialog/use-link-dialog.tsx`
- Modify: `src/components/tiles/text/toolbar/link-button.tsx`

- [ ] **Step 1: Update IContentProps and LinkDialogContent**

In `use-link-dialog.tsx`, update the `IContentProps` interface and `LinkDialogContent` component:

```typescript
import React, { useContext, useEffect, useState } from "react";
import { CustomElement, Editor, EFormat, ReactEditor, Transforms } from "@concord-consortium/slate-editor";

import { useCustomModal } from "../../../../hooks/use-custom-modal";
import { TileModelContext } from "../../tile-api";
import { logTileChangeEvent } from "../../../../models/tiles/log/log-tile-change-event";
import { LogEventName } from "../../../../lib/logger-types";

import LinkIcon from "../../../../assets/icons/text/link-text-icon.svg";
import './use-link-dialog.scss';

interface IContentProps {
  setUrl: React.Dispatch<React.SetStateAction<string>>;
  displayMode: string;
  setDisplayMode: (mode: string) => void;
  text: string;
  url: string;
}
export const LinkDialogContent = ({ setUrl, displayMode, setDisplayMode, text, url }: IContentProps) => {
  return (
    <div className="link-dialog-content">
      <p>Link text: {text}</p>
      <input
        placeholder="URL"
        onChange={e => setUrl(e.target.value)}
        spellCheck={false}
        type="url"
        value={url}
      />
      <fieldset className="display-as-fieldset">
        <legend>Display as:</legend>
        <div className="radio-button-container">
          <input
            type="radio"
            id="display-link"
            name="displayMode"
            value="link"
            checked={displayMode === "link"}
            onChange={e => { if (e.target.checked) setDisplayMode(e.target.value); }}
          />
          <label htmlFor="display-link">Link</label>
        </div>
        <div className="radio-button-container">
          <input
            type="radio"
            id="display-button"
            name="displayMode"
            value="button"
            checked={displayMode === "button"}
            onChange={e => { if (e.target.checked) setDisplayMode(e.target.value); }}
          />
          <label htmlFor="display-button">Button</label>
        </div>
      </fieldset>
    </div>
  );
};
```

- [ ] **Step 2: Update the useLinkDialog hook**

Update the `IProps` interface and hook to manage `displayMode` state and logging:

```typescript
interface IProps {
  editor: Editor;
  onClose?: () => void;
  selectedLink?: any;
  text: string;
  tileId?: string;
}
export const useLinkDialog = ({ editor, onClose, selectedLink, text, tileId }: IProps) => {
  const [url, setUrl] = useState(selectedLink?.href ?? "");
  const [displayMode, setDisplayMode] = useState<string>(selectedLink?.displayMode ?? "link");

  useEffect(() => {
    setUrl(selectedLink?.href ?? "");
    setDisplayMode(selectedLink?.displayMode ?? "link");
  }, [selectedLink]);

  const handleDisplayModeChange = (mode: string) => {
    setDisplayMode(mode);
    if (tileId) {
      logTileChangeEvent(LogEventName.TEXT_LINK_DISPLAY_CHANGE, {
        operation: "display-mode-change",
        change: { displayMode: mode },
        tileId
      });
    }
  };

  const handleClick = () => {
    if (selectedLink) {
      const at = ReactEditor.findPath(editor, selectedLink);
      if (url === "") {
        Transforms.unwrapNodes(editor, { at });
      } else {
        Transforms.setNodes(
          editor,
          { ...selectedLink, href: url, displayMode },
          { at }
        );
      }
    } else {
      const element = {
        type: EFormat.link,
        href: url,
        displayMode
      } as CustomElement;
      Transforms.wrapNodes(editor, element, { split: true });
      Transforms.collapse(editor, { edge: "end" });
    }
  };

  const [showModal, hideModal] = useCustomModal({
    className: "link-editor-modal",
    Icon: LinkIcon,
    title: "Link Editor",
    Content: LinkDialogContent,
    contentProps: { setUrl, displayMode, setDisplayMode: handleDisplayModeChange, text, url },
    buttons: [
      { label: "Cancel" },
      { label: "Save",
        isDefault: true,
        onClick: handleClick
      }
    ],
    onClose
  }, [selectedLink, text, url, displayMode]);

  return [showModal, hideModal];
};
```

- [ ] **Step 3: Update link-button.tsx to pass tileId**

In `src/components/tiles/text/toolbar/link-button.tsx`, add `TileModelContext` import and pass `tileId`:

```typescript
import React, { useContext } from "react";
import { Editor, EFormat, Node, Range, selectedNodesOfType, useSlate } from "@concord-consortium/slate-editor";

import { useLinkDialog } from "../dialog/use-link-dialog";
import { TileToolbarButton } from "../../../toolbar/tile-toolbar-button";
import { IToolbarButtonComponentProps } from "../../../toolbar/toolbar-button-manager";
import { TileModelContext } from "../../tile-api";

import LinkToolIcon from "../../../../assets/icons/text/link-text-icon.svg";

export const LinkButton = ({name}: IToolbarButtonComponentProps) => {
  const editor = useSlate();
  const model = useContext(TileModelContext);
  const { selection } = editor;
  const isCollapsed = selection ? Range.isCollapsed(selection) : true;
  const selectedLinks = selectedNodesOfType(editor, EFormat.link);
  const selectedLink = selectedLinks[0] || undefined;
  const isSelected = !!selectedLink;
  const disabled = isCollapsed && !isSelected;
  const text = isSelected
    ? Node.string(selectedLink)
    : selection
    ? Editor.string(editor, selection)
    : "";
  const [showModal] = useLinkDialog({ editor, selectedLink, text, tileId: model?.id });
  const handleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    showModal();
  };
  return(
    <TileToolbarButton name={name} title="Link" disabled={disabled} selected={isSelected} onClick={handleClick}>
      <LinkToolIcon/>
    </TileToolbarButton>
  );
};
```

- [ ] **Step 4: Run existing text tile tests**

```bash
npm test -- src/components/tiles/text --no-coverage
```

Expected: all existing tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/tiles/text/dialog/use-link-dialog.tsx \
        src/components/tiles/text/toolbar/link-button.tsx
git commit -m "feat(link-editor): add Display as radio buttons with logging (CLUE-476)"
```

---

### Task 3: Style the modal — Lato font, 300×300, teal Save button, radio layout

**Files:**
- Modify: `src/components/tiles/text/dialog/use-link-dialog.scss`
- Modify: `src/hooks/custom-modal.scss`

- [ ] **Step 1: Update use-link-dialog.scss**

Replace the entire file with:

```scss
.link-editor-modal {
  width: 300px;
  height: 300px;
}

.link-dialog-content {
  margin: 10px 0;
  font-family: Lato, sans-serif;

  input[type="url"] {
    width: 100%;

    &:invalid {
      outline-color: red;
    }
  }

  .display-as-fieldset {
    border: none;
    padding: 10px 0 0 0;
    margin: 0;

    legend {
      padding: 0;
      font-weight: bold;
      margin-bottom: 5px;
    }

    .radio-button-container {
      display: flex;
      align-items: center;
      margin-bottom: 4px;

      input[type="radio"] {
        margin: 0 6px 0 0;
        height: auto;
      }

      label {
        cursor: pointer;
      }
    }
  }
}
```

- [ ] **Step 2: Update custom-modal.scss — Lato font and teal Save button**

In `src/hooks/custom-modal.scss`, add `font-family` to `.modal-button` (line 95) and change the `.default` background color:

Find:
```scss
    .modal-button {
      cursor: pointer;
      height: $modal-control-height;
      min-width: $modal-button-min-width;
      margin-left: $modal-button-spacing;
      color: $charcoal-dark-2;
      background-color: white;
      border: $modal-control-border;
      border-radius: $modal-control-border-radius;
      outline: none;

      &.disabled {
        opacity: 35%;
      }

      &.default:not(.disabled) {
        background-color: $charcoal-light-6;
      }
```

Replace with:
```scss
    .modal-button {
      cursor: pointer;
      height: $modal-control-height;
      min-width: $modal-button-min-width;
      margin-left: $modal-button-spacing;
      color: $charcoal-dark-2;
      background-color: white;
      border: $modal-control-border;
      border-radius: $modal-control-border-radius;
      outline: none;
      font-family: Lato, sans-serif;

      &.disabled {
        opacity: 35%;
      }

      &.default:not(.disabled) {
        background-color: $workspace-teal-light-4;
      }
```

- [ ] **Step 3: Commit**

```bash
git add src/components/tiles/text/dialog/use-link-dialog.scss \
        src/hooks/custom-modal.scss
git commit -m "style(link-editor): Lato font, 300x300 modal, teal Save button"
```

---

### Task 4: Write tests

**Files:**
- Create: `src/components/tiles/text/dialog/use-link-dialog.test.tsx`

- [ ] **Step 1: Write the test file**

```typescript
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import Modal from "react-modal";
import { ModalProvider } from "@concord-consortium/react-modal-hook";
import { Provider } from "mobx-react";
import { specStores } from "../../../../models/stores/spec-stores";
import { LinkDialogContent } from "./use-link-dialog";

describe("LinkDialogContent", () => {
  const defaultProps = {
    setUrl: jest.fn(),
    displayMode: "link",
    setDisplayMode: jest.fn(),
    text: "example text",
    url: "https://example.com"
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders with Link radio selected by default", () => {
    render(<LinkDialogContent {...defaultProps} />);
    const linkRadio = screen.getByLabelText("Link") as HTMLInputElement;
    const buttonRadio = screen.getByLabelText("Button") as HTMLInputElement;
    expect(linkRadio.checked).toBe(true);
    expect(buttonRadio.checked).toBe(false);
  });

  it("renders with Button radio selected when displayMode is button", () => {
    render(<LinkDialogContent {...defaultProps} displayMode="button" />);
    const linkRadio = screen.getByLabelText("Link") as HTMLInputElement;
    const buttonRadio = screen.getByLabelText("Button") as HTMLInputElement;
    expect(linkRadio.checked).toBe(false);
    expect(buttonRadio.checked).toBe(true);
  });

  it("calls setDisplayMode when Button radio is clicked", () => {
    render(<LinkDialogContent {...defaultProps} />);
    const buttonRadio = screen.getByLabelText("Button");
    fireEvent.click(buttonRadio);
    expect(defaultProps.setDisplayMode).toHaveBeenCalledWith("button");
  });

  it("calls setDisplayMode when Link radio is clicked", () => {
    render(<LinkDialogContent {...defaultProps} displayMode="button" />);
    const linkRadio = screen.getByLabelText("Link");
    fireEvent.click(linkRadio);
    expect(defaultProps.setDisplayMode).toHaveBeenCalledWith("link");
  });

  it("renders the Display as fieldset with legend", () => {
    render(<LinkDialogContent {...defaultProps} />);
    expect(screen.getByText("Display as:")).toBeInTheDocument();
  });

  it("renders the URL input with current value", () => {
    render(<LinkDialogContent {...defaultProps} />);
    const input = screen.getByPlaceholderText("URL") as HTMLInputElement;
    expect(input.value).toBe("https://example.com");
  });

  it("calls setUrl when input changes", () => {
    render(<LinkDialogContent {...defaultProps} />);
    const input = screen.getByPlaceholderText("URL");
    fireEvent.change(input, { target: { value: "https://new-url.com" } });
    expect(defaultProps.setUrl).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npm test -- src/components/tiles/text/dialog/use-link-dialog.test.tsx --no-coverage
```

Expected: all 7 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/tiles/text/dialog/use-link-dialog.test.tsx
git commit -m "test(link-editor): add Display as radio button tests"
```

---

## Verification Checklist

Manual verification after implementation:

1. `npm start` → open QA unit → create a text tile → select text → click Link button
2. Link Editor modal appears at 300×300px with Lato font
3. "Display as:" label with Link and Button radio buttons appear below URL input
4. Link radio is selected by default
5. Clicking Button radio selects it, Link deselects
6. Clicking the "Button" label text also selects the radio
7. Cancel button has Lato font, white background
8. Save button has Lato font, teal background (`$workspace-teal-light-4`)
9. Save button hover shows darker teal
10. Edit an existing link → Display as retains its previous selection
11. Check browser console for `TEXT_LINK_DISPLAY_CHANGE` log event when switching radio
12. `npm test -- src/components/tiles/text --no-coverage` → all tests pass
13. `npm run check:types` → no TypeScript errors
