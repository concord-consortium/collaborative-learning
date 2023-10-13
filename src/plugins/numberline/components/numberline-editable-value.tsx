import { observer } from 'mobx-react';
import React, { useState } from 'react';


import "./numberline-tile.scss";

interface IEditableValueProps {
  value?: number;
  onChange?: (value: number) => void;
  axisWidth: number;
  readOnly?: boolean;
  onBeginEdit?: () => void;
}

export const EditableValue: React.FC<IEditableValueProps> = observer(function NumberlineTile(props){
  console.log("📁 numberline-editable-value.tsx ------------------------");
  const { value, onChange, axisWidth, readOnly, onBeginEdit } = props;

  const [isEditing, setIsEditing] = useState(false);
  const [editingTitle, setEditingTitle] = useState(-5);



  const handleClick = () => {
    if (!readOnly && !isEditing) {
      console.log("\t🏭 handleClick");
      setIsEditing(true);
    }
  };

  const handleClose = (accept: boolean) => {
    console.log("\t🏭 handleClose");
    setIsEditing(false);
  };

  const autoFocusAndSelect = (input: HTMLInputElement | null) => {
    input?.focus();
    input?.select();
  };

  console.log("📁 numberline-editable-min-textbox.tsx ------------------------");
  console.log("\t🥩 axisWidth:", axisWidth);
  const leftPosition = `${(axisWidth * (0.01)).toFixed(2)}px`;
  console.log("\t🔪 leftPosition:", leftPosition);
  // leftPosition = "100px";
  const containerStyle: React.CSSProperties = { left: `${leftPosition}`};

      // <div className="min-box">


  return (
    <div
      className="min-box"
      style={containerStyle}
      onClick={handleClick}
    >
      {isEditing
        ? <input className="min-textbox" ref={autoFocusAndSelect} />
        : <div className="editable-value">{editingTitle}</div>
      }
    </div>
  );
});

export default EditableValue;
