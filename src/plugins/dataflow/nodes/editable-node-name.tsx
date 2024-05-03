import React, { useState } from 'react';
import { IBaseNode } from './base-node';

interface EditableNodeNameProps {
  node:IBaseNode;
}

export const EditableNodeName: React.FC<EditableNodeNameProps> = ({ node }) => {
  const [nodeName, setNodeName] = useState(node.model.orderedDisplayName);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setNodeName(e.target.value);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  }

  function saveNodeName(){
    nodeName && node.model.setOrderedDisplayName(nodeName);
  }

  const valueString = node.readOnly ? node.model.orderedDisplayName : nodeName;

  return (
    <div className="node-name">
      <input
        className="node-name-input"
        value={valueString}
        onChange={handleInputChange}
        onBlur={saveNodeName}
        disabled={node.readOnly}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
};
