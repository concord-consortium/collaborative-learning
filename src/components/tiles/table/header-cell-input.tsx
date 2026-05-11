import React from "react";

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
  // beta.44 no longer provides built-in classes for the editor container (`display: contents`)
  // or input (`inline-size: 100%; block-size: 100%`). Apply the equivalents inline so the
  // editor matches the cell bounds instead of taking the input's default ~150-180px width.
  return (
    <div className="rdg-editor-container clue-editor-container" style={{ ...style, display: "contents" }}>
      <input
        style={{ width: "100%", ...inputStyle }}
        ref={autoFocusAndSelect}
        value={value}
        onKeyDown={onKeyDown}
        onChange={event => onChange(event.target.value)}
        onBlur={() => onClose(true)}
      />
    </div>
  );
};
