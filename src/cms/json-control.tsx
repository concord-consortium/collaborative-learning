import React, { useCallback } from "react";

import "./json-control.scss";

export const JsonControl = (props: any) => {
  const { label, value, onChange } = props;
  const handleChange = useCallback(
    (e: any) => {
      const newValue = e.target.value;
      try {
        const json = JSON.parse(newValue);
        onChange(json);
        console.log(`SUCCESS`, json);
      } catch (error) {
        console.log(`illegal json`, newValue);
        onChange(newValue);
      }
    },
    [onChange]
  );

  const displayValue = value
    ? typeof value === "string"
      ? value
      : JSON.stringify(value, null, 2)
    : "";

  return (
    <div className="json-control">
      <label htmlFor="jsonControl">{label}</label>
      <textarea
        id="jsonControl"
        value={displayValue}
        onChange={handleChange}
      />
    </div>
  );
};
