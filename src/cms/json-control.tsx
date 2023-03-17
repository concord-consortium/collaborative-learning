import React, { useCallback, useRef } from "react";

import "./json-control.scss";

export const JsonControl = (props: any) => {
  const { label, onChange } = props;

  const valueString = useRef<string>("");
  
  const handleChange = useCallback(
    (e: any) => {
      valueString.current = e.target.value;
      try {
        const json = JSON.parse(valueString.current);
        onChange(json);
        console.log(`SUCCESS`, json);
      } catch (error) {
        console.log(`illegal json`, valueString.current);
        onChange(valueString.current);
      }
    },
    [onChange]
  );

  return (
    <div className="json-control">
      <label htmlFor="jsonControl">{label}</label>
      <textarea
        id="jsonControl"
        value={valueString.current}
        onChange={handleChange}
      />
    </div>
  );
};
