import React from "react";
import { RDG_INTERNAL_EDITOR_CONTAINER_CLASS, RDG_INTERNAL_TEXT_EDITOR_CLASS } from "./cell-text-editor";

function autoFocusAndSelect(input: HTMLInputElement | null) {
  input?.focus();
  input?.select();
}

interface IProps {
  style?: React.CSSProperties;
  inputStyle?: React.CSSProperties;
  value: string;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onChange: (value: string) => void;
  onClose: (accept: boolean) => void;
}
export const HeaderCellInput: React.FC<IProps> = ({ style, inputStyle, value, onKeyDown, onChange, onClose }) => {
  const containerClasses = `rdg-editor-container clue-editor-container ${RDG_INTERNAL_EDITOR_CONTAINER_CLASS}`;
  const editorClasses = `rdg-text-editor ${RDG_INTERNAL_TEXT_EDITOR_CLASS}`;
  return (
    <div className={containerClasses} style={style}>
      <input
        className={editorClasses} style={inputStyle}
        ref={autoFocusAndSelect}
        value={value}
        onKeyDown={onKeyDown}
        onChange={event => onChange(event.target.value)}
        onBlur={() => onClose(true)}
      />
    </div>
  );
};
