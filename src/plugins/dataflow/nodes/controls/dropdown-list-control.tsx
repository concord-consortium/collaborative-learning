// FIXME: ESLint is unhappy with these control components
/* eslint-disable react-hooks/rules-of-hooks */
import React, { FunctionComponent, SVGProps, useRef } from "react";
import Rete, { NodeEditor, Node, Control } from "rete";
import classNames from "classnames";
import { useStopEventPropagation, useCloseDropdownOnOutsideEvent } from "./custom-hooks";
import DropdownCaretIcon from "../../assets/icons/dropdown-caret.svg";
import { dataflowLogEvent } from "../../dataflow-logger";
import { NodeChannelInfo } from "../../model/utilities/channel";
import { kGripperOutputTypes } from "../../model/utilities/node";

import "./dropdown-list-control.scss";

export interface ListOption {
  active?: boolean;
  name: string;
  displayName?: string;
  icon?: FunctionComponent<SVGProps<SVGSVGElement>>;
  val?: string | number; // if an option includes `val`, it will be used as the value, otherwise `name` will
}

type DisabledChecker = (opt: ListOption) => boolean;

const optionValue = (opt: ListOption) => Object.prototype.hasOwnProperty.call(opt, "val") ? opt.val : opt.name;
const optionLabelClass = (str?: string) => {
  const optClass = str?.toLowerCase().replace(/ /g, "-") ?? "";
  return "label " + optClass;
};
export class DropdownListControl extends Rete.Control {
  private emitter: NodeEditor;
  private component: any;
  private props: any;
  constructor(emitter: NodeEditor,
              key: string,
              node: Node,
              optionArray: ListOption[],
              readonly = false,
              label = "",
              tooltip = "Select Type") {
    super(key);
    this.emitter = emitter;
    this.key = key;

    const handleChange = (onChange: any) => {
      return (e: any) => { onChange(e.target.value); };
    };
    this.component = (compProps: {
                                    value: string | number;
                                    onItemClick: () => void;
                                    onListClick: () => void;
                                    showList: boolean
                                    optionArray: ListOption[];
                                    listClass: string;
                                    label: string;
                                    isDisabled?: DisabledChecker,
                                    tooltip: string;
                                  }) => (
      <div className="node-select-container" title={compProps.tooltip}>
        { label &&
        <div className="node-select-label">{label}</div>
        }
        { renderDropdownList(compProps.value,
                             compProps.showList,
                             compProps.onItemClick,
                             compProps.onListClick,
                             compProps.optionArray,
                             compProps.listClass,
                             compProps.isDisabled) }
      </div>
    );

    const renderDropdownList = (val: string | number,
                                showList: boolean,
                                onItemClick: () => void,
                                onListClick: any,
                                options: ListOption[],
                                listClass: string,
                                isDisabled?: DisabledChecker) => {
      const divRef = useRef<HTMLDivElement>(null);
      useStopEventPropagation(divRef, "pointerdown");
      useStopEventPropagation(divRef, "wheel");
      const listRef = useRef<HTMLDivElement>(null);
      useCloseDropdownOnOutsideEvent(listRef, () => this.props.showList, () => {
                                      this.props.showList = false;
                                      (this as any).update();
                                    });
      const option = options.find((opt) => optionValue(opt) === val);
      const name = option?.name ?? val.toString();
      const displayName = option?.displayName ?? name;
      const icon = option?.icon?.({}) || null;
      const activeHub = option?.active;
      const liveNode = this.getNode().name.substring(0, 4) === "Live";
      const disableSelected = this.key === "hubSelect" && liveNode && !activeHub;
      const labelClasses = disableSelected ? "disabled item top" : "item top";

      return (
        <div className={`node-select ${listClass}`} ref={divRef}>
          <div className={labelClasses} onMouseDown={handleChange(onItemClick)}>
            { icon && <svg className="icon top">{icon}</svg> }
            <div className={optionLabelClass(displayName)}>{displayName}</div>
            <svg className="icon dropdown-caret">
              <DropdownCaretIcon />
            </svg>
          </div>
          {showList ?
          <div className={`option-list ${listClass}`} ref={listRef}>
            {options.map((ops: any, i: any) => {

              const disabled = ops.active === false || isDisabled?.(ops);
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
                  onMouseDown={!disabled ? onListClick(optionValue(ops)) : null}
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
    };

    const initial = node.data[key] || optionArray[0].name;
    node.data[key] = initial;

    this.props = {
      readonly,
      value: initial,
      onItemClick: (v: any) => {
        this.emitter.trigger("selectnode", { node: this.getNode() });
        this.props.showList = !this.props.showList;
        (this as any).update();
        dataflowLogEvent("nodedropdownclick", this as Control, this.getNode().meta.inTileWithId as string);
      },
      onListClick: (v: any) => () => {
        this.emitter.trigger("selectnode", { node: this.getNode() });
        this.props.showList = !this.props.showList;
        this.setValue(v);
        this.emitter.trigger("process");
        dataflowLogEvent("nodedropdownselection", this as Control, this.getNode().meta.inTileWithId as string);
      },
      showList: false,
      optionArray,
      listClass: key,
      label,
      isDisabled: null,
      tooltip
    };
  }

  public setValue = (val: any) => {
    this.props.value = val;
    this.putData(this.key, val);
    (this as any).update();
  };

  public getValue = () => {
    return this.props.value;
  };

  public getSelectionId = () => {
    const optionArray = this.props.optionArray;
    const value = this.props.value;
    if (optionArray && value){
      const selectedOption = optionArray.find((option: ListOption) => optionValue(option) === value);
      const selectionId = selectedOption ? selectedOption.id : undefined;
      return selectionId;
    }
  };

  /**
   * Is passed a function that will check each list option to see if it should
   * be disabled
   */
  public setDisabledFunction = (fn: DisabledChecker) => {
    this.props.isDisabled = fn;
    this.ensureValueIsInBounds();
    (this as any).update();
  };

  public setOptions = (options: ListOption[]) => {
    this.props.optionArray = options;
    (this as any).update();
  };

  public setActiveOption = (hubId: string, state: boolean) => {
    if (this.props.optionArray){
      const targetHub = this.props.optionArray.filter((o: any) => o.id === hubId);
      if(targetHub[0]){
        targetHub[0].active = state;
      }
    }
  };

  public setChannels = (channels: NodeChannelInfo[]) => {
    this.props.channels = channels;
  };

  public getChannels = () => {
    return this.props.channels;
  };

  /**
   * This is called both when we load (in case the options have changed, and the user
   * has a value that is no longer valid) and every time the isDisabled function changes.
   * If the control has a value that is no longer valid, we pick the best option: if the
   * values are numeric, we pick the closest enabled option. Otherwise, we pick the
   * first enabled option.
   */
  private ensureValueIsInBounds = () => {
    const { optionArray, value } = this.props;
    const enabledOptions: ListOption[] = optionArray.filter( (opt: ListOption) => (
      !this.props.isDisabled || !this.props.isDisabled(opt)
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
  };
}
/* eslint-enable */
