import React, { FunctionComponent, SVGProps, useCallback, useRef, useState } from "react";
import { makeObservable, observable } from "mobx";
import { observer } from "mobx-react";
import { ClassicPreset } from "rete";
import classNames from "classnames";
import { useStopEventPropagation, useCloseDropdownOnOutsideEvent } from "./custom-hooks";
import { kGripperOutputTypes } from "../../model/utilities/node";
import { IBaseNode, IBaseNodeModel } from "../nodes/base-node";

import DropdownCaretIcon from "../../assets/icons/dropdown-caret.svg";

import "./dropdown-list-control.scss";

export interface ListOption {
  active?: boolean;
  name: string;
  displayName?: string;
  icon?: FunctionComponent<SVGProps<SVGSVGElement>>;
  // This property is used by a nodes that work with a "hubSelect" control
  id?: string;
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

  // TODO: this used to set the initial value of the if it wasn't set based on the first
  // option in the list passed in. I'm not sure if that is needed anymore.
  constructor(
    public node: NodeType,
    public modelKey: Key,

    public optionArray: ListOption[],
    public label = "",
    public tooltip = "Select Type"
  ) {
    super();

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

    // trigger a reprocess so our new value propagates through the nodes
    this.node.process();
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

  // TODO: this used to have setChannels and getChannels
  // It isn't clear why these were stored in this control
  // The channels were not used as the list options, those were set separately
  // I think this list control was just used a place to store them so other parts
  // of the system could look them up based on the node.
  // We should be able to find a better place to store them.

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

  // This is used by the live output node
  public setOptions(options: ListOption[]) {
    // TODO: if the options array needs to be observed, we'll need to do more here
    // so the passed in options are observed too
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
}

export interface IDropdownListControl {
  id: string;
  model: IBaseNodeModel;
  modelKey: string;
  optionArray: ListOption[];
  label: string;
  tooltip: string;
  getValue(): string;
  setValue(val: string): void;
  disabledFunction?: DisabledChecker;
  logEvent(operation: string): void;
}

const DropdownList: React.FC<{
  control: IDropdownListControl,
  options: ListOption[],
  listClass: string
}> = observer(function DropdownList(props) {
  const { control, options, listClass } = props;

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
  const name = option?.name ?? val.toString(); // TODO: I'm not sure this is needed anymore???
  const displayName = option?.displayName ?? name;
  const icon = option?.icon?.({}) || null;
  const activeHub = option?.active !== false;
  const liveNode = control.model.type.substring(0,4) === "Live";
  const disableSelected = control.modelKey === "hubSelect" && liveNode && !activeHub;
  const labelClasses = classNames("item top", { disabled: disableSelected });

  const onItemClick = useCallback((v: any) => {
    // TODO: need to figure out how to trigger the node selection
    // We currently don't have node, and we don't have the the area plugin (or which ever plugin)
    // in order to select the node.
    // this.emitter.trigger("selectnode", {node: this.getNode()});
    setShowList(value => !value);

    control.logEvent("nodedropdownclick");
  }, [control]);

  // Generate a handler for each list item
  const onListClick = useCallback((v: string) => () => {
    // TODO: need to trigger node selection see above
    // this.emitter.trigger("selectnode", {node: this.getNode()});
    setShowList(value => !value);
    control.setValue(v);

    control.logEvent("nodedropdownselection");
  }, [control]);

  return (
    <div className={`node-select ${listClass}`} ref={divRef}>
      <div className={labelClasses} onMouseDown={onItemClick}>
        { icon && <svg className="icon top">{icon}</svg> }
        <div className={optionLabelClass(displayName)}>{displayName}</div>
        <svg className="icon dropdown-caret">
          <DropdownCaretIcon />
        </svg>
      </div>
      {showList ?
      <div className={`option-list ${listClass}`} ref={listRef}>
        {options.map((ops: any, i: any) => {
          const disabled = ops.active === false || control.disabledFunction?.(ops);
          const className = classNames("item", listClass, {
            disabled,
            selectable: !disabled,
            selected: optionValue(ops) === val,
            microbit: ops.name.includes("micro:bit"),
            gripper: kGripperOutputTypes.includes(ops.name)
          });
          return (
            <div
              className={className}
              key={i}
              onMouseDown={!disabled ? onListClick(optionValue(ops)) : undefined}
            >
              { ops.icon &&
                <svg className="icon">
                  {ops.icon()}
                </svg>
              }
              <div className={optionLabelClass(ops.displayName)}>
                {ops.displayName ?? ops.name}
              </div>
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
  const { label, tooltip } = control;

  return (
    <div className="node-select-container" title={tooltip}>
      { label &&
        <div className="node-select-label">{label}</div>
      }
      <DropdownList
        control={control}
        options={control.optionArray}
        listClass={control.modelKey}
      />
    </div>
  );
};
