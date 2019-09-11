import * as React from "react";
import { BaseComponent, IBaseProps } from "./dataflow-base";
import { NodeTypes } from "../utilities/node";
import { inject, observer } from "mobx-react";

import "./dataflow-program-toolbar.sass";

interface IProps {
  onNodeCreateClick: (type: string) => void;
  onClearClick: () => void;
  onResetClick: () => void;
  isTesting: boolean;
  isDataStorageDisabled: boolean;
  disabled: boolean;
}

@inject("stores")
@observer
export class DataflowProgramToolbar extends BaseComponent<IProps, {}> {
  constructor(props: IProps) {
    super(props);
  }

  public render() {
    const { isTesting } = this.props;
    return (
      <div className="program-toolbar" data-test="program-toolbar">
        { NodeTypes.map((nt: any, i: any) => (
            this.renderAddNodeButton(nt.name, i)
          ))
        }
        { isTesting && <button onClick={this.props.onClearClick}>Clear</button> }
        { isTesting && <button onClick={this.props.onResetClick}>Reset</button> }
      </div>
    );
  }

  public renderAddNodeButton(nodeType: string, i: number) {
    const handleAddNodeButtonClick = () => { this.props.onNodeCreateClick(nodeType); };
    const iconClass = "icon-block " + nodeType.toLowerCase().replace(" ", "-");
    const nodeIcons = [];
    switch (nodeType) {
      case "Number":
      case "Sensor":
      case "Generator":
        nodeIcons.push(<div className="icon-node right mid" key={"icon-node-r-m" + i}/>);
        break;
      case "Math":
      case "Logic":
        nodeIcons.push(<div className="icon-node left top" key={"icon-node-l-t" + i}/>);
        nodeIcons.push(<div className="icon-node right mid" key={"icon-node-r-m" + i}/>);
        nodeIcons.push(<div className="icon-node left bottom" key={"icon-node-l-b" + i}/>);
        break;
      case "Transform":
        nodeIcons.push(<div className="icon-node left mid" key={"icon-node-l-m" + i}/>);
        nodeIcons.push(<div className="icon-node right mid" key={"icon-node-r-m" + i}/>);
        break;
      case "Relay":
      case "Data Storage":
        nodeIcons.push(<div className="icon-node left mid" key={"icon-node-l-m" + i}/>);
        break;
    }
    return (
      <button
        disabled={nodeType === "Data Storage" && this.props.isDataStorageDisabled || this.props.disabled}
        key={i}
        onClick={handleAddNodeButtonClick}
      >
        <div className={iconClass}>{nodeIcons}</div>
        <div className="label">{nodeType}</div>
      </button>
    );
  }

}
