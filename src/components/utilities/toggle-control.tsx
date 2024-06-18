import React from "react";

import "./toggle-control.scss";

interface IProps {
  className?: string;
  dataTest?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  title?: string;
}

const ToggleControl: React.FC<IProps> = ({ className, dataTest, value, onChange, title }) => {

  const handleClick = () => {
    onChange(!value);
  };

  const onClass = value ? "toggle-on" : "";

  return (
    <div className={`toggle-control ${className}`} data-test={dataTest} title={title} onClick={handleClick}>
      <div className={`track ${onClass}`}/>
      <div className={`ball ${onClass}`}/>
    </div>
  );
};

export default ToggleControl;
