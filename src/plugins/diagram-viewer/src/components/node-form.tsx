import { observer } from "mobx-react-lite";
import { Instance } from "mobx-state-tree";
import React from "react";
import { DQNode, Operation } from "../models/dq-node";

interface IProps {
    node: Instance<typeof DQNode>;
  }
  
const _NodeForm: React.FC<IProps> = ({ node }) => {
  const onValueChange = (evt: any) => {
    // if the value is null or undefined just store undefined
    if (evt.target.value == null) {
      node.setValue(undefined);
    } else {
      node.setValue(parseFloat(evt.target.value));
    }
  };

  const onUnitChange = (evt: any) => {
    if (!evt.target.value) {
      node.setUnit(undefined);
    } else {
      node.setUnit(evt.target.value);
    }
  };

  const onNameChange = (evt: any) => {
    if (!evt.target.value) {
      node.setName(undefined);
    } else {
      node.setName(evt.target.value);
    }
  };

  const onOperationChange = (evt: any) => {
    if (!evt.target.value) {
      node.setOperation(undefined);
    } else {
      node.setOperation(evt.target.value);
    }
  };

  return (
    <div style={{zIndex: 4, position: "absolute"}}>
      <div>
        <label>name:</label>
        <input value={node.name || ""} onChange={onNameChange}/>
      </div>
      <div>
        <label>value:</label>
        <input type="number" value={node.value ?? ""} onChange={onValueChange}/>
      </div>
      <div>
        <label>unit:</label>
        <input value={node.unit || ""} onChange={onUnitChange}/>
      </div>
      <div>
        <label>operation:</label>
        <select value={node.operation || ""} onChange={onOperationChange}>
          { // in an enumeration the keys are the names and the values are string or 
            // numeric identifier
          }
          <option key="none" value="">none</option>
          {Object.entries(Operation).map(([name, symbol]) => 
            <option key={symbol} value={symbol}>{name}</option>
          )}
        </select>
      </div>
    </div>
  );
};

export const NodeForm = observer(_NodeForm);
NodeForm.displayName = "NodeForm";
