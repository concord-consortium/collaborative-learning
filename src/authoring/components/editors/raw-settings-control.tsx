
import React, { useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";

import "./raw-settings-control.scss";

interface Props {
  initialValue: any;
  onSave?: (newValue: any) => void;
}

const RawSettingsControl: React.FC<Props> = ({ initialValue, onSave }) => {
  const valueRef = React.useRef(JSON.stringify(initialValue, null, 2));
  const [validJSON, setValidJSON] = useState(true);

  const handleValueChange = (val: string) => {
    valueRef.current = val;
    try {
      JSON.parse(val);
      setValidJSON(true);
    } catch {
      setValidJSON(false);
    }
  };

  const handleSave = () => {
    onSave?.(JSON.parse(valueRef.current));
  };

  return (
    <div className="raw-settings-control-container">
      <div className="raw-settings-upper-buttons">
        <button onClick={handleSave} disabled={!validJSON || !onSave}>
          Save
        </button>
        {!validJSON && <span className="invalid-json-warning">Invalid JSON</span>}
      </div>
      <CodeMirror
        value={valueRef.current}
        height="400px"
        extensions={[json()]}
        onChange={handleValueChange}
        theme="light"
        className="raw-settings-control"
      />
    </div>
  );
};

export default RawSettingsControl;
