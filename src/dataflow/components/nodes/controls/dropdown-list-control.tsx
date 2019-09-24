import * as React from "react";
import { useRef } from "react";
import Rete, { NodeEditor, Node } from "rete";
import { useStopEventPropagation } from "./custom-hooks";
import "./dropdown-list-control.sass";

interface ListOption {
  name: string;
  icon?: string;
  val?: string | number; // if an option includes `val`, it will be used as the value, otherwise `name` will
}

export class DropdownListControl extends Rete.Control {
  private emitter: NodeEditor;
  private component: any;
  private props: any;
  constructor(emitter: NodeEditor, key: string, node: Node, optionArray: ListOption[], readonly = false, label = "") {
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
                             compProps.listClass) }
      </div>
    );

    const renderDropdownList = (val: string | number,
                                showList: boolean,
                                onItemClick: () => void,
                                onListClick: any,
                                options: ListOption[],
                                listClass: string) => {
      const divRef = useRef<HTMLDivElement>(null);
      useStopEventPropagation(divRef, "pointerdown");
      const optionValue = (opt: ListOption) => opt.hasOwnProperty("val") ? opt.val : opt.name;
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
            {options.map((ops: any, i: any) => (
              <div
                className={ops.name === val ? `item ${listClass} selected` : `item ${listClass} selectable`}
                key={i}
                onMouseDown={onListClick(optionValue(ops))}
              >
                { ops.icon &&
                <svg className="icon">
                  <use xlinkHref={`#${ops.icon}`}/>
                </svg>
                }
                <div className="label">{ops.name}</div>
              </div>
            ))}
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
      label
    };
  }

  public setValue = (val: any) => {
    this.props.value = val;
    this.putData(this.key, val);
    (this as any).update();
  }

  public getValue = () => {
    return this.props.value;
  }

  public setOptions = (options: any) => {
    this.props.optionArray = options;
  }
}
