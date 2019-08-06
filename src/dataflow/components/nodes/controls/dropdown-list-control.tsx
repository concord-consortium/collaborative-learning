import * as React from "react";
import { useRef, useEffect } from "react";
import Rete, { NodeEditor, Node } from "rete";
import "./dropdown-list-control.sass";

export class DropdownListControl extends Rete.Control {
  private emitter: NodeEditor;
  private component: any;
  private props: any;
  constructor(emitter: NodeEditor, key: string, node: Node, optionArray: any, readonly = false) {
    super(key);
    this.emitter = emitter;
    this.key = key;

    const handleChange = (onChange: any) => {
      return (e: any) => { onChange(e.target.value); };
    };
    const handlePointerDown = (e: PointerEvent) => e.stopPropagation();

    this.component = (compProps: {
                                    value: string;
                                    onItemClick: () => void;
                                    onListClick: () => void;
                                    showList: boolean
                                    optionArray: any;
                                    listClass: string;
                                  }) => (
      <div>
        { renderDropdownList(compProps.value,
                             compProps.showList,
                             compProps.onItemClick,
                             compProps.onListClick,
                             compProps.optionArray,
                             compProps.listClass) }
      </div>
    );

    const renderDropdownList = (val: string,
                                showList: boolean,
                                onItemClick: () => void,
                                onListClick: any,
                                options: any,
                                listClass: string) => {
      const divRef = useRef<HTMLDivElement>(null);
      useEffect(() => {
        divRef.current && divRef.current.addEventListener("pointerdown", handlePointerDown);
        return () => {
          divRef.current && divRef.current.removeEventListener("pointerdown", handlePointerDown);
        };
      }, []);
      let icon = "";
      const option = options.find((op: any) => op.name === val);
      if (option && option.icon) {
        icon = `#${option.icon}`;
      }

      return (
        <div className={`node-select ${listClass}`} ref={divRef}>
          <div className="item top" onMouseDown={handleChange(onItemClick)}>
            <svg className="icon top">
              <use xlinkHref={icon}/>
            </svg>
            <div className="label">{val}</div>
            <svg className="icon arrow">
              <use xlinkHref="#icon-down-arrow"/>
            </svg>
          </div>
          {showList ?
          <div className="option-list">
            {options.map((ops: any, i: any) => (
              <div
                className={ops.name === val ? `item ${listClass} selected` : `item ${listClass} selectable`}
                key={i}
                onMouseDown={onListClick(ops.name)}
              >
                <svg className="icon">
                  <use xlinkHref={`#${ops.icon}`}/>
                </svg>
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
