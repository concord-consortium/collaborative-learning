import React, { FunctionComponent, SVGProps, useEffect, useRef, useState } from "react";
import { action, computed, makeObservable, observable } from "mobx";
import { observer } from "mobx-react";
import { ClassicPreset } from "rete";
import classNames from "classnames";
import { useStopEventPropagation, useCloseDropdownOnOutsideEvent } from "./custom-hooks";
import { IBaseNode, IBaseNodeModel } from "../base-node";
import { handleBlockChildKeyDown } from "../dataflow-node";

import DropdownCaretIcon from "../../../../assets/dropdown-caret.svg";

import "./dropdown-list-control.scss";

export interface ListOption {
  active?: boolean;
  name: string;
  displayName?: string;
  icon?: FunctionComponent<SVGProps<SVGSVGElement>>;
  // This property is used by a nodes that work with a "hubSelect" control
  id?: string;
  // This property is used by hardware menus where some options can
  // be temporarily missing, but still selectable
  missing?: boolean;
}

type DisabledChecker = (opt: ListOption) => boolean;

// We used to support the `val` property on the list options, I could not find references to that in the current code
// const optionValue = (opt: ListOption) => Object.prototype.hasOwnProperty.call(opt, "val") ? opt.val : opt.name;
const optionValue = (opt: ListOption) => opt.name;
const optionLabelClass = (str?: string) => {
  const optClass = str?.toLowerCase().replace(/ /g, "-") ?? "";
  return "label " + optClass;
};

export class DropdownListControl<
  ModelType extends
    Record<Key, string> &
    IBaseNodeModel,
  NodeType extends { model: ModelType } & IBaseNode,
  Key extends keyof NodeType['model'] & string
>
  extends ClassicPreset.Control
  implements IDropdownListControl
{
  @observable
  disabledFunction?: DisabledChecker;

  @observable
  optionArray: ListOption[];

  private optionsFunc?: () => ListOption[];

  // TODO: this used to set the initial value of the if it wasn't set based on the first
  // option in the list passed in. I'm not sure if that is needed anymore.
  constructor(
    public node: NodeType,
    public modelKey: Key,
    public setter: (val: string) => void,
    optionArray: ListOption[],
    public tooltip = "Select Type", // This is not currently passed
    public placeholder = "Select an option",

    // Use a function for the options so they can be computed
    optionsFunc?: () => ListOption[]
  ) {
    super();
    this.optionArray = optionArray;
    this.optionsFunc = optionsFunc;

    makeObservable(this);
  }

  public get model() {
    return this.node.model;
  }

  public setValue(val: string) {
    this.setter(val);
  }

  public getValue() {
    return this.model[this.modelKey];
  }

  /**
   * Is passed a function that will check each list option to see if it should
   * be disabled
   */
  public setDisabledFunction(fn: DisabledChecker) {
    this.disabledFunction = fn;
    this.ensureValueIsInBounds();
  }

  /**
   * If the control has a value that is no longer valid, we pick the best option: if the
   * values are numeric, we pick the closest enabled option. Otherwise, we pick the
   * first enabled option.
   *
   * TODO: this had a comment saying it was also called "when we load (in case the options
   * have changed, and the user has a value that is no longer valid)".
   * It is no longer being called anywhere else. Even in master at the point of this
   * update.
   *
   */
  private ensureValueIsInBounds() {
    const { optionArray } = this;
    const value = this.getValue();
    const enabledOptions: ListOption[] = optionArray.filter( (opt: ListOption) => (
      !this.disabledFunction || !this.disabledFunction(opt)
    ));
    if (enabledOptions.find(opt => optionValue(opt) === value)) {
      return;
    }
    // our value is not valid and we need to pick a new one
    if (typeof(value) === "number") {
      let smallestDiff = Infinity;
      let closestOption;
      enabledOptions.forEach(opt => {
        const optionVal = optionValue(opt);
        if (typeof(optionVal) !== "number") return;
        const diff = Math.abs(optionVal - value);
        if (diff < smallestDiff) {
          smallestDiff = diff;
          closestOption = opt;
        }
      });
      if (closestOption) {
        this.setValue(optionValue(closestOption));
        return;
      }
    }
    this.setValue(optionValue(enabledOptions[0]));
  }

  public getSelectionId() {
    const optionArray = this.optionArray;
    const value = this.getValue();
    if (optionArray && value){
      const selectedOption = optionArray.find((option: ListOption) => optionValue(option) === value);
      const selectionId = selectedOption ? selectedOption.id : undefined;
      return selectionId;
    }
  }

  @computed
  public get options() {
    if (this.optionsFunc) {
      return this.optionsFunc();
    }
    return this.optionArray;
  }

  @action
  public setOptions(options: ListOption[]) {
    if (this.optionsFunc) {
      console.warn("This dropdown list is using an options function instead of array");
    }
    // This should automatically convert the passed in array to be observable
    // so changes to the properties of the options will be observed too
    this.optionArray = options;
  }

  // This is used by the live output node
  @action
  public setActiveOption(id: string, state: boolean) {
    if (this.optionArray){
      const option = this.optionArray.find(o => o.id === id);
      if(option){
        option.active = state;
      }
    }
  }

  public logEvent(operation: string) {
    this.node.logControlEvent(operation, "nodedropdown", this.modelKey, this.getValue());
  }

  public selectNode() {
    this.node.select();
  }
}

export interface IDropdownListControl {
  id: string;
  node: IBaseNode;
  model: IBaseNodeModel;
  modelKey: string;
  options: ListOption[];
  setOptions(options: ListOption[]): void;
  tooltip: string;
  placeholder: string;
  getValue(): string;
  setValue(val: string): void;
  disabledFunction?: DisabledChecker;
  setActiveOption(id: string, state: boolean): void;
  logEvent(operation: string): void;
  selectNode(): void;
  getSelectionId(): string | undefined;
}

const ListOptionComponent: React.FC<{option: ListOption}> = ({option}) => (
  <>
    { option.icon &&
      <svg className="icon">
        {option.icon({})}
      </svg>
    }
    <div className={optionLabelClass(option.displayName)}>
      {option.displayName ?? option.name}
    </div>
  </>
);

export const DropdownList: React.FC<{
  control: IDropdownListControl,
  listClass: string,
}> = observer(function DropdownList(props) {
  const { control, listClass } = props;
  const title = control.tooltip;
  const { options, placeholder } = control;
  const divRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useStopEventPropagation(divRef, "pointerdown");
  useStopEventPropagation(divRef, "wheel");

  const [showList, setShowList] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  useCloseDropdownOnOutsideEvent(listRef, () => showList, () => {
    setShowList(false);
  });

  // Focus the listbox when it opens so subsequent key events route to handleListKeyDown.
  // (React's autoFocus prop is only valid on form elements, not on <div>.)
  useEffect(() => {
    if (showList) listRef.current?.focus();
  }, [showList]);

  const val = control.getValue();
  const option = options.find((opt) => optionValue(opt) === val);
  const currentIndex = options.findIndex(opt => optionValue(opt) === val);
  const activeHub = option?.active !== false;
  const liveNode = control.model.type.substring(0,4) === "Live";
  const disableSelected = control.modelKey === "hubSelect" && liveNode && !activeHub;
  const labelClasses = classNames("item top", { disabled: disableSelected, missing: option?.missing });
  const listboxId = `dropdown-listbox-${control.id}`;

  const isOptionDisabled = (opt: ListOption) =>
    opt.active === false || control.disabledFunction?.(opt) === true;

  const moveHighlight = (delta: 1 | -1) => {
    let i = highlightedIndex;
    for (let step = 0; step < options.length; step++) {
      i = (i + delta + options.length) % options.length;
      if (!isOptionDisabled(options[i])) {
        setHighlightedIndex(i);
        return;
      }
    }
  };

  const findFirstEnabledIndex = (start: number, dir: 1 | -1): number => {
    let i = start;
    for (let step = 0; step < options.length; step++) {
      if (!isOptionDisabled(options[i])) return i;
      i = (i + dir + options.length) % options.length;
    }
    return start;
  };

  const open = () => {
    control.selectNode();
    setShowList(true);
    const startIndex = currentIndex >= 0 && !isOptionDisabled(options[currentIndex])
      ? currentIndex
      : findFirstEnabledIndex(0, 1);
    setHighlightedIndex(startIndex);
    control.logEvent("nodedropdownclick");
  };

  const close = () => {
    setShowList(false);
  };

  const commit = (i: number) => {
    if (isOptionDisabled(options[i])) return;
    control.selectNode();
    control.setValue(optionValue(options[i]));
    setShowList(false);
    control.logEvent("nodedropdownselection");
    triggerRef.current?.focus();
  };

  const handleTriggerClick = () => {
    if (showList) {
      close();
    } else {
      open();
    }
  };

  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open();
      return;
    }
    // ArrowDown used to open the listbox, but the in-block roving cycle now owns
    // the arrow keys; Enter/Space is the canonical "open" gesture.
    handleBlockChildKeyDown(e);
  };

  const handleListKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown": e.preventDefault(); moveHighlight(1); break;
      case "ArrowUp":   e.preventDefault(); moveHighlight(-1); break;
      case "Home":      e.preventDefault(); setHighlightedIndex(findFirstEnabledIndex(0, 1)); break;
      case "End":       e.preventDefault();
                        setHighlightedIndex(findFirstEnabledIndex(options.length - 1, -1)); break;
      case "Enter":
      case " ":         e.preventDefault(); commit(highlightedIndex); break;
      case "Escape":    e.preventDefault(); close(); triggerRef.current?.focus(); break;
      case "Tab":       close(); break; // let Tab proceed
    }
  };

  return (
    <div className={`node-select ${listClass}`} ref={divRef} title={title}>
      <button
        ref={triggerRef}
        type="button"
        className={labelClasses}
        tabIndex={-1}
        disabled={control.node.readOnly}
        aria-haspopup="listbox"
        aria-expanded={showList}
        aria-controls={listboxId}
        aria-label={`${title}: ${option?.displayName ?? option?.name ?? placeholder}`}
        onMouseDown={handleTriggerClick}
        onKeyDown={handleTriggerKeyDown}
      >
        { option
          ? <ListOptionComponent option={option}/>
          : <div className="label unselected">{placeholder}</div>
        }
        <svg className="icon dropdown-caret">
          <DropdownCaretIcon />
        </svg>
      </button>
      {showList && (
        <div
          id={listboxId}
          ref={listRef}
          className={`option-list ${listClass}`}
          role="listbox"
          tabIndex={-1}
          aria-activedescendant={`${listboxId}-opt-${highlightedIndex}`}
          onKeyDown={handleListKeyDown}
        >
          {options.map((ops, i) => {
            const disabled = isOptionDisabled(ops);
            const className = classNames("item", listClass, {
              disabled,
              selectable: !disabled,
              selected: optionValue(ops) === val,
              highlighted: i === highlightedIndex,
              missing: ops.missing
            });
            return (
              <div
                id={`${listboxId}-opt-${i}`}
                role="option"
                aria-selected={optionValue(ops) === val}
                aria-disabled={disabled}
                className={className}
                key={i}
                onMouseDown={!disabled ? () => commit(i) : undefined}
              >
                <ListOptionComponent option={ops} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

export const DropdownListControlComponent: React.FC<{ data: IDropdownListControl}> = (props) => {
  const control = props.data;

  return (
    <div className="node-select-container">
      <DropdownList
        control={control}
        listClass={control.modelKey}
      />
    </div>
  );
};
