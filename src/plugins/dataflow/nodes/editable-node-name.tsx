import React, { useRef, useState } from 'react';
import { IBaseNode } from './base-node';
import { observer } from 'mobx-react';
import { handleBlockChildKeyDown } from './dataflow-node';

interface EditableNodeNameProps {
  node: IBaseNode;
}

export const EditableNodeName: React.FC<EditableNodeNameProps> = observer(
  function EditableNodeName({ node }) {
    const [nodeName, setNodeName] = useState(node.model.orderedDisplayName);
    // Tracks whether the upcoming blur is a discard (Escape) so `saveNodeName`
    // can skip writing. We can't rely on resetting `nodeName` state before the
    // blur — the state update is batched and the blur handler reads the stale
    // (still-edited) closure value.
    const discardingRef = useRef(false);

    function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
      setNodeName(e.target.value);
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
      if (e.key === 'Enter') {
        e.currentTarget.blur();
        return;
      }
      if (e.key === 'Escape') {
        discardingRef.current = true;
        setNodeName(node.model.orderedDisplayName);
        e.currentTarget.blur();
        discardingRef.current = false;
        return;
      }
      // ArrowLeft/ArrowRight stay native (caret movement); ArrowUp/Down/Home/End rove.
      handleBlockChildKeyDown(e);
    }

    function saveNodeName() {
      if (discardingRef.current) return;
      nodeName && node.model.setOrderedDisplayName(nodeName);
    }

    const valueString = node.readOnly ? node.model.orderedDisplayName : nodeName;

    return (
      <div className="node-name">
        <input
          className="node-name-input"
          aria-label="Block name"
          tabIndex={-1}
          value={valueString}
          onChange={handleInputChange}
          onBlur={saveNodeName}
          disabled={node.readOnly}
          onKeyDown={handleKeyDown}
        />
      </div>
    );
  }
);
