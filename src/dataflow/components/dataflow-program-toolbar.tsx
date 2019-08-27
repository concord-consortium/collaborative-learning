import * as React from "react";
import { NodeTypes } from "../utilities/node";

import "./dataflow-program-toolbar.sass";

interface IProps {
  onNodeCreateClick: (type: string) => void;
  onDeleteClick: () => void;
  isDataStorageDisabled: boolean;
  disabled: boolean;
}

export class DataflowProgramToolbar extends React.Component<IProps, {}> {
  constructor(props: IProps) {
    super(props);
  }

  public render() {
    return (
      <div className="program-toolbar" data-test="program-toolbar">
        { NodeTypes.map((nt: any, i: any) => (
            this.renderAddNodeButton(nt.name, i)
          ))
        }
        <button onClick={this.props.onDeleteClick} disabled={this.props.disabled}>Delete</button>
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
        nodeIcons.push(<div className="icon-node right mid" />);
        break;
      case "Math":
      case "Logic":
        nodeIcons.push(<div className="icon-node left top" />);
        nodeIcons.push(<div className="icon-node right mid" />);
        nodeIcons.push(<div className="icon-node left bottom" />);
        break;
      case "Transform":
        nodeIcons.push(<div className="icon-node left mid" />);
        nodeIcons.push(<div className="icon-node right mid" />);
        break;
      case "Relay":
      case "Data Storage":
        nodeIcons.push(<div className="icon-node left mid" />);
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
