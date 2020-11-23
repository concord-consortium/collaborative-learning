import React from "react";

function autoFocusAndSelect(input: HTMLInputElement | null) {
  input?.focus();
  input?.select();
}

interface IProps {
  style?: React.CSSProperties;
  value?: string;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onChange: (value: string) => void;
  onClose: (accept: boolean) => void;
}
export const HeaderCellInput: React.FC<IProps> = ({ style, value, onKeyDown, onChange, onClose }) => {
  return (
    <div className="rdg-editor-container clue-editor-container" style={style}>
      <input
        className="rdg-text-editor"
        ref={autoFocusAndSelect}
        value={value}
        onKeyDown={onKeyDown}
        onChange={event => onChange(event.target.value)}
        onBlur={() => onClose(true)}
      />
    </div>
  );
};
