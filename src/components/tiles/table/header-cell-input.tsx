import React, { useState } from "react";

function autoFocusAndSelect(input: HTMLInputElement | null) {
  input?.focus();
  input?.select();
}

interface IProps {
  style?: React.CSSProperties;
  inputStyle?: React.CSSProperties;
  /** The text the input starts with. The input keeps its own draft after that. It is mounted only
   * while editing, so each edit starts from the value current when the edit began, even if the
   * value changed while the caller stayed mounted. */
  initialValue: string;
  /** What the input edits, such as "Column name". Screen readers announce it with the value. */
  ariaLabel: string;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>, value: string) => void;
  onClose: (accept: boolean, value: string) => void;
}
export const HeaderCellInput: React.FC<IProps> = ({
  style, inputStyle, initialValue, ariaLabel, onKeyDown, onClose
}) => {
  const [value, setValue] = useState(initialValue);
  return (
    <div className="rdg-editor-container clue-editor-container" style={{ ...style, display: "contents" }}>
      <input
        style={{ width: "100%", ...inputStyle }}
        aria-label={ariaLabel}
        ref={autoFocusAndSelect}
        value={value}
        onKeyDown={e => onKeyDown(e, value)}
        onChange={event => setValue(event.target.value)}
        onBlur={() => onClose(true, value)}
      />
    </div>
  );
};
