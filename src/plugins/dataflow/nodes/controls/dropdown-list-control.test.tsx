import { fireEvent, render } from "@testing-library/react";
import React from "react";
import {
  DropdownList,
  IDropdownListControl,
  ListOption,
} from "./dropdown-list-control";

interface IFakeControlOptions {
  id?: string;
  options: ListOption[];
  initialValue?: string;
  modelKey?: string;
  modelType?: string;
  disabledFunction?: (opt: ListOption) => boolean;
  readOnly?: boolean;
}

interface IFakeControl extends IDropdownListControl {
  setValueCalls: string[];
  logEventCalls: string[];
  selectNodeCalls: number;
}

function makeFakeControl(opts: IFakeControlOptions): IFakeControl {
  let value = opts.initialValue ?? "";
  const setValueCalls: string[] = [];
  const logEventCalls: string[] = [];
  const fake: IFakeControl = {
    id: opts.id ?? "ctl-1",
    node: { readOnly: !!opts.readOnly } as any,
    model: { type: opts.modelType ?? "Number" } as any,
    modelKey: opts.modelKey ?? "value",
    options: opts.options,
    setOptions: () => undefined,
    tooltip: "Pick option",
    placeholder: "Select an option",
    getValue: () => value,
    setValue: (v: string) => {
      value = v;
      setValueCalls.push(v);
    },
    disabledFunction: opts.disabledFunction,
    setActiveOption: () => undefined,
    logEvent: (op: string) => { logEventCalls.push(op); },
    selectNode: () => { fake.selectNodeCalls++; },
    getSelectionId: () => undefined,
    setValueCalls,
    logEventCalls,
    selectNodeCalls: 0,
  };
  return fake;
}

const threeOptions: ListOption[] = [
  { name: "alpha", displayName: "Alpha" },
  { name: "beta", displayName: "Beta" },
  { name: "gamma", displayName: "Gamma" },
];

function renderDropdown(control: IDropdownListControl) {
  return render(<DropdownList control={control} listClass="value" />);
}

function getTrigger(container: HTMLElement) {
  return container.querySelector('button[aria-haspopup="listbox"]') as HTMLButtonElement;
}

function getListbox(container: HTMLElement) {
  return container.querySelector('[role="listbox"]') as HTMLDivElement | null;
}

describe("DropdownList trigger element (CLUE-455)", () => {
  it("renders the trigger as a button with aria-haspopup=listbox", () => {
    const control = makeFakeControl({ options: threeOptions });
    const { container } = renderDropdown(control);
    const trigger = getTrigger(container);
    expect(trigger).not.toBeNull();
    expect(trigger.getAttribute("aria-haspopup")).toBe("listbox");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(trigger.getAttribute("aria-controls")).toBe("dropdown-listbox-ctl-1");
  });

  it("includes the current option in the trigger's aria-label", () => {
    const control = makeFakeControl({ options: threeOptions, initialValue: "beta" });
    const { container } = renderDropdown(control);
    expect(getTrigger(container).getAttribute("aria-label")).toBe("Pick option: Beta");
  });

  it("falls back to the placeholder in the aria-label when no value is set", () => {
    const control = makeFakeControl({ options: threeOptions });
    const { container } = renderDropdown(control);
    expect(getTrigger(container).getAttribute("aria-label")).toBe("Pick option: Select an option");
  });
});

describe("DropdownList opening behavior (CLUE-455)", () => {
  it("opens the listbox on Enter and reports aria-expanded=true", () => {
    const control = makeFakeControl({ options: threeOptions });
    const { container } = renderDropdown(control);
    const trigger = getTrigger(container);
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(getListbox(container)).not.toBeNull();
  });

  it("opens the listbox on Space", () => {
    const control = makeFakeControl({ options: threeOptions });
    const { container } = renderDropdown(control);
    fireEvent.keyDown(getTrigger(container), { key: " " });
    expect(getListbox(container)).not.toBeNull();
  });

  it("does not open the listbox on ArrowDown — the in-block roving cycle owns arrow keys", () => {
    // Block-level arrow keys move between interactive descendants of the focused
    // block (CLUE-455 composite-widget pattern). Enter and Space are the canonical
    // gestures for opening the dropdown.
    const control = makeFakeControl({ options: threeOptions });
    const { container } = renderDropdown(control);
    fireEvent.keyDown(getTrigger(container), { key: "ArrowDown" });
    expect(getListbox(container)).toBeNull();
  });

  it("highlights the currently-selected option when opened", () => {
    const control = makeFakeControl({ options: threeOptions, initialValue: "beta" });
    const { container } = renderDropdown(control);
    fireEvent.keyDown(getTrigger(container), { key: "Enter" });
    expect(getListbox(container)?.getAttribute("aria-activedescendant"))
      .toBe("dropdown-listbox-ctl-1-opt-1");
  });
});

describe("DropdownList listbox keyboard navigation (CLUE-455)", () => {
  function openWithListbox() {
    const control = makeFakeControl({ options: threeOptions });
    const utils = renderDropdown(control);
    fireEvent.keyDown(getTrigger(utils.container), { key: "Enter" });
    return { control, ...utils };
  }

  it("ArrowDown advances aria-activedescendant to the next option", () => {
    const { container } = openWithListbox();
    const listbox = getListbox(container)!;
    fireEvent.keyDown(listbox, { key: "ArrowDown" });
    expect(listbox.getAttribute("aria-activedescendant"))
      .toBe("dropdown-listbox-ctl-1-opt-1");
  });

  it("ArrowUp from the first option wraps to the last", () => {
    const { container } = openWithListbox();
    const listbox = getListbox(container)!;
    fireEvent.keyDown(listbox, { key: "ArrowUp" });
    expect(listbox.getAttribute("aria-activedescendant"))
      .toBe("dropdown-listbox-ctl-1-opt-2");
  });

  it("Home jumps to the first option", () => {
    const { container } = openWithListbox();
    const listbox = getListbox(container)!;
    fireEvent.keyDown(listbox, { key: "ArrowDown" });
    fireEvent.keyDown(listbox, { key: "ArrowDown" });
    fireEvent.keyDown(listbox, { key: "Home" });
    expect(listbox.getAttribute("aria-activedescendant"))
      .toBe("dropdown-listbox-ctl-1-opt-0");
  });

  it("End jumps to the last option", () => {
    const { container } = openWithListbox();
    const listbox = getListbox(container)!;
    fireEvent.keyDown(listbox, { key: "End" });
    expect(listbox.getAttribute("aria-activedescendant"))
      .toBe("dropdown-listbox-ctl-1-opt-2");
  });

  it("ArrowDown skips disabled options", () => {
    const control = makeFakeControl({
      options: [
        { name: "alpha" },
        { name: "beta", active: false },
        { name: "gamma" },
      ],
    });
    const { container } = renderDropdown(control);
    fireEvent.keyDown(getTrigger(container), { key: "Enter" });
    const listbox = getListbox(container)!;
    fireEvent.keyDown(listbox, { key: "ArrowDown" });
    expect(listbox.getAttribute("aria-activedescendant"))
      .toBe("dropdown-listbox-ctl-1-opt-2");
  });
});

describe("DropdownList commit and dismiss (CLUE-455)", () => {
  it("Enter on a highlighted option commits the value and closes the listbox", () => {
    const control = makeFakeControl({ options: threeOptions });
    const { container } = renderDropdown(control);
    fireEvent.keyDown(getTrigger(container), { key: "Enter" });
    fireEvent.keyDown(getListbox(container)!, { key: "ArrowDown" });
    fireEvent.keyDown(getListbox(container)!, { key: "Enter" });
    expect(control.setValueCalls).toEqual(["beta"]);
    expect(getListbox(container)).toBeNull();
  });

  it("Space on a highlighted option commits the value and closes the listbox", () => {
    const control = makeFakeControl({ options: threeOptions });
    const { container } = renderDropdown(control);
    fireEvent.keyDown(getTrigger(container), { key: "Enter" });
    fireEvent.keyDown(getListbox(container)!, { key: "ArrowDown" });
    fireEvent.keyDown(getListbox(container)!, { key: " " });
    expect(control.setValueCalls).toEqual(["beta"]);
    expect(getListbox(container)).toBeNull();
  });

  it("Escape closes the listbox without committing and returns focus to the trigger", () => {
    const control = makeFakeControl({ options: threeOptions, initialValue: "alpha" });
    const { container } = renderDropdown(control);
    const trigger = getTrigger(container);
    fireEvent.keyDown(trigger, { key: "Enter" });
    fireEvent.keyDown(getListbox(container)!, { key: "ArrowDown" });
    fireEvent.keyDown(getListbox(container)!, { key: "Escape" });
    expect(control.setValueCalls).toEqual([]);
    expect(getListbox(container)).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("Tab closes the listbox without committing", () => {
    const control = makeFakeControl({ options: threeOptions });
    const { container } = renderDropdown(control);
    fireEvent.keyDown(getTrigger(container), { key: "Enter" });
    fireEvent.keyDown(getListbox(container)!, { key: "Tab" });
    expect(control.setValueCalls).toEqual([]);
    expect(getListbox(container)).toBeNull();
  });

  it("clicking outside closes the listbox", () => {
    const control = makeFakeControl({ options: threeOptions });
    const { container } = renderDropdown(control);
    fireEvent.keyDown(getTrigger(container), { key: "Enter" });
    fireEvent.pointerDown(document.body);
    expect(getListbox(container)).toBeNull();
  });
});

describe("DropdownList read-only behavior (CLUE-455)", () => {
  it("marks the trigger button aria-disabled when the node is read-only", () => {
    const control = makeFakeControl({ options: threeOptions, readOnly: true });
    const { container } = renderDropdown(control);
    expect(getTrigger(container).getAttribute("aria-disabled")).toBe("true");
  });

  it("does not mark the trigger button aria-disabled when the node is editable", () => {
    const control = makeFakeControl({ options: threeOptions, readOnly: false });
    const { container } = renderDropdown(control);
    expect(getTrigger(container).getAttribute("aria-disabled")).toBe("false");
  });

  it("does not open the listbox on Enter when the node is read-only", () => {
    const control = makeFakeControl({ options: threeOptions, readOnly: true });
    const { container } = renderDropdown(control);
    fireEvent.keyDown(getTrigger(container), { key: "Enter" });
    expect(container.querySelector('[role="listbox"]')).toBeNull();
  });
});
