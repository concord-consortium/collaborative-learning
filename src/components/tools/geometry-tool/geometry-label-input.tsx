import React from "react";

function autoFocusAndSelect(input: HTMLInputElement | null) {
  input?.focus();
  input?.select();
}

interface IProps {
  style?: React.CSSProperties;
  value: string;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onChange: (value: string) => void;
  onBlur: (value: string) => void;
}
export const GeometryLabelInput: React.FC<IProps> = ({ style, value, onKeyDown, onChange, onBlur }) => {
  return (
    <div className="clue-editor-container" style={style}>
      <input
        className="clue-editor-input focusable"
        style={style}
        ref={autoFocusAndSelect}
        value={value}
        onKeyDown={onKeyDown}
        onChange={event => onChange(event.target.value)}
        onBlur={event => onBlur(event.target.value)}
      />
    </div>
  );
};
