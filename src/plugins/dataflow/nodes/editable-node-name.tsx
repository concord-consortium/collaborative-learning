import React, { useEffect, useRef, useState } from 'react';
import { IBaseNode } from './base-node';
import { observer } from 'mobx-react';
import { handleBlockChildKeyDown } from './dataflow-node';
import { useStopEventPropagation } from './controls/custom-hooks';

interface EditableNodeNameProps {
  node: IBaseNode;
}

export const EditableNodeName: React.FC<EditableNodeNameProps> = observer(
  function EditableNodeName({ node }) {
    const [nodeName, setNodeName] = useState(node.model.orderedDisplayName);
    // A ref rather than state: this must not re-render on focus. The input is controlled, so a
    // render triggered by focusing would rewrite its DOM value and move the caret to the end.
    const editingRef = useRef(false);

    // The model name can change under this input -- renaming the node's column in a linked table
    // writes it (see syncNodeNamesFromColumns). Without this the input keeps its stale draft, and
    // the next blur saves that draft back over the rename, silently undoing it. Not while editing,
    // so a student's half-typed name is never yanked out from under them.
    useEffect(() => {
      if (!editingRef.current) setNodeName(node.model.orderedDisplayName);
    }, [node.model.orderedDisplayName]);
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
      editingRef.current = false;
      if (discardingRef.current || node.readOnly) return;
      nodeName && node.model.setOrderedDisplayName(nodeName);
    }

    const valueString = node.readOnly ? node.model.orderedDisplayName : nodeName;

    const [inputEl, setInputEl] = useState<HTMLInputElement | null>(null);
    useStopEventPropagation(inputEl, "pointerdown");
    useStopEventPropagation(inputEl, "dblclick");

    return (
      <div className="node-name">
        <input
          ref={setInputEl}
          className="node-name-input"
          aria-label="Block name"
          tabIndex={-1}
          value={valueString}
          onChange={handleInputChange}
          onFocus={() => { editingRef.current = true; }}
          onBlur={saveNodeName}
          readOnly={node.readOnly}
          onKeyDown={handleKeyDown}
        />
      </div>
    );
  }
);
