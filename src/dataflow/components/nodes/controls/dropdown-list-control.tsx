import * as React from "react";
import { useRef } from "react";
import Rete, { NodeEditor, Node } from "rete";
import { useStopEventPropagation } from "./custom-hooks";
import "./dropdown-list-control.sass";

export interface ListOption {
  name: string;
  icon?: string;
  val?: string | number; // if an option includes `val`, it will be used as the value, otherwise `name` will
}

type DisabledChecker = (opt: ListOption) => boolean;

const optionValue = (opt: ListOption) => opt.hasOwnProperty("val") ? opt.val : opt.name;

export class DropdownListControl extends Rete.Control {
  private emitter: NodeEditor;
  private component: any;
  private props: any;
  constructor(emitter: NodeEditor, key: string, node: Node, optionArray: ListOption[], readonly = false, label = "") {
    super(key);
    this.emitter = emitter;
    this.key = key;

    window.addEventListener("pointerdown", this.handlePointerDown, true);

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
                                    isDisabled?: DisabledChecker;
                                  }) => (
      <div className="node-select-container">
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
      const option = options.find((opt) => optionValue(opt) === val);
      const name = option ? option.name : val;
      const icon = option && option.icon ? `#${option.icon}` : null;

      return (
        <div className={`node-select ${listClass}`} ref={divRef}>
          <div className="item top" onMouseDown={handleChange(onItemClick)}>
            { icon &&
            <svg className="icon top">
              <use xlinkHref={icon}/>
            </svg>
            }
            <div className="label">{name}</div>
            <svg className="icon dropdown-caret">
              <use xlinkHref="#icon-dropdown-caret"/>
            </svg>
          </div>
          {showList ?
          <div className={`option-list ${listClass}`}>
            {options.map((ops: any, i: any) => {
              let className = `item ${listClass}`;
              const disabled = isDisabled && isDisabled(ops);
              if (optionValue(ops) === val) {
                className += " selected";
              } else if (disabled) {
                className += " disabled";
              } else {
                className += " selectable";
              }
              return (
                <div
                  className={className}
                  key={i}
                  onMouseDown={!disabled ? onListClick(optionValue(ops)) : null}
                >
                  { ops.icon &&
                  <svg className="icon">
                    <use xlinkHref={`#${ops.icon}`}/>
                  </svg>
                  }
                  <div className="label">{ops.name}</div>
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
        this.props.showList = !this.props.showList;
        (this as any).update();
      },
      onListClick: (v: any) => () => {
        this.props.showList = !this.props.showList;
        (this as any).update();
        this.setValue(v);
        this.emitter.trigger("process");
      },
      showList: false,
      optionArray,
      listClass: key,
      label,
      isDisabled: null
    };
  }

  public handlePointerDown = () => {
    this.props.showList = false;
    (this as any).update();
  }

  public setValue = (val: any) => {
    this.props.value = val;
    this.putData(this.key, val);
    (this as any).update();
  }

  public getValue = () => {
    return this.props.value;
  }

  /**
   * Is passed a function that will check each list option to see if it should
   * be disabled
   */
  public setDisabledFunction = (fn: DisabledChecker) => {
    this.props.isDisabled = fn;
    this.ensureValueIsInBounds();
    (this as any).update();
  }

  public setOptions = (options: any) => {
    this.props.optionArray = options;
  }

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
    return;
  }
}
