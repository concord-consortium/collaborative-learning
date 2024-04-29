import React, { FunctionComponent, SVGProps, useCallback, useRef, useState } from "react";
import { action, computed, makeObservable, observable } from "mobx";
import { observer } from "mobx-react";
import { ClassicPreset } from "rete";
import classNames from "classnames";
import { useStopEventPropagation, useCloseDropdownOnOutsideEvent } from "./custom-hooks";
import { IBaseNode, IBaseNodeModel } from "../base-node";

import DropdownCaretIcon from "../../assets/icons/dropdown-caret.svg";

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
    Record<`set${Capitalize<Key>}`, (val: string) => void> &
    IBaseNodeModel,
  NodeType extends { model: ModelType } & IBaseNode,
  Key extends keyof NodeType['model'] & string
>
  extends ClassicPreset.Control
  implements IDropdownListControl
{
  setter: (val: string) => void;

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

    optionArray: ListOption[],
    public tooltip = "Select Type", // This is not currently passed
    public placeholder = "Select an option",

    // Use a function for the options so they can be computed
    optionsFunc?: () => ListOption[]
  ) {
    super();
    this.optionArray = optionArray;
    this.optionsFunc = optionsFunc;

    const setterProp = "set" + modelKey.charAt(0).toUpperCase() + modelKey.slice(1) as `set${Capitalize<Key>}`;

    // The typing above using `set${Capitalize<Key>}` almost works, but it fails here
    // I'm pretty sure there is a way to make it work without having to use the "as any" here
    this.setter = this.model[setterProp] as any;

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
  public setActiveOption(id: string, state: boolean) {
    if (this.optionArray){
      const option = this.optionArray.find(o => o.id === id);
      if(option){
        // TODO: this is not currently triggering any updates itself
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
  model: IBaseNodeModel;
  modelKey: string;
  options: ListOption[];
  setOptions(options: ListOption[]): void;
  tooltip: string;
  placeholder: string;
  getValue(): string;
  setValue(val: string): void;
  disabledFunction?: DisabledChecker;
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
  useStopEventPropagation(divRef, "pointerdown");
  useStopEventPropagation(divRef, "wheel");
  const listRef = useRef<HTMLDivElement>(null);

  const [showList, setShowList] = useState(false);

  // This will reset the listeners on every render because internally it has a useEffect depending
  // on the two callbacks
  useCloseDropdownOnOutsideEvent(listRef, () => showList, () => {
    setShowList(false);
  });

  const val = control.getValue();
  const option = options.find((opt) => optionValue(opt) === val);
  const activeHub = option?.active !== false;
  const liveNode = control.model.type.substring(0,4) === "Live";
  const disableSelected = control.modelKey === "hubSelect" && liveNode && !activeHub;
  const labelClasses = classNames("item top", { disabled: disableSelected, missing: option?.missing });

  const onItemClick = useCallback((v: any) => {
    control.selectNode();
    setShowList(value => !value);

    control.logEvent("nodedropdownclick");
  }, [control]);

  // Generate a handler for each list item
  const onListClick = useCallback((v: string) => () => {
    control.selectNode();
    setShowList(value => !value);
    control.setValue(v);

    control.logEvent("nodedropdownselection");
  }, [control]);

  return (
    <div className={`node-select ${listClass}`} ref={divRef} title={title}>
      <div className={labelClasses} onMouseDown={onItemClick}>
        { option
          ? <ListOptionComponent option={option}/>
          : <div className="label unselected">{placeholder}</div>
        }
        <svg className="icon dropdown-caret">
          <DropdownCaretIcon />
        </svg>
      </div>
      {showList ?
      <div className={`option-list ${listClass}`} ref={listRef}>
        {options.map((ops, i) => {
          const disabled = ops.active === false || control.disabledFunction?.(ops);
          const missing = ops.missing;
          const className = classNames("item", listClass, {
            disabled,
            selectable: !disabled,
            selected: optionValue(ops) === val,
            missing
          });
          return (
            <div
              className={className}
              key={i}
              onMouseDown={!disabled ? onListClick(optionValue(ops)) : undefined}
            >
              <ListOptionComponent option={ops} />
            </div>
          );
        })}
      </div>
      : null }
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
