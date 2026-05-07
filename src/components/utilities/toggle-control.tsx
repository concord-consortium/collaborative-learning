import React from "react";

import "./toggle-control.scss";

interface IProps {
  className?: string;
  dataTest?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  title: string;
}

const ToggleControl: React.FC<IProps> = ({ className, dataTest, value, onChange, title }) => {

  const handleClick = () => {
    onChange(!value);
  };

  const onClass = value ? "toggle-on" : "";

  return (
    <button
      aria-checked={value}
      aria-label={title}
      className={`toggle-control ${className ?? ""}`}
      data-test={dataTest}
      role="switch"
      title={title}
      type="button"
      onClick={handleClick}
    >
      <span className={`track ${onClass}`} aria-hidden="true" />
      <span className={`ball ${onClass}`} aria-hidden="true" />
    </button>
  );
};

export default ToggleControl;
