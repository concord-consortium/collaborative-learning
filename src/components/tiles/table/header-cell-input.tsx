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
  const editorClasses = `${RDG_INTERNAL_TEXT_EDITOR_CLASS}`;
  // beta.44 dropped the canary-internal classes that made the container `display: contents`
  // and the input `inline-size: 100%; block-size: 100%`. Apply the equivalents inline so the
  // editor matches the cell bounds instead of taking the input's default ~150-180px width.
  return (
    <div className={containerClasses} style={{ ...style, display: "contents" }}>
      <input
        className={editorClasses} style={{ width: "100%", ...inputStyle }}
        ref={autoFocusAndSelect}
        value={value}
        onKeyDown={onKeyDown}
        onChange={event => onChange(event.target.value)}
        onBlur={() => onClose(true)}
      />
    </div>
  );
};
