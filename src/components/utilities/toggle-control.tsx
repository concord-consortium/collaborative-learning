import React, { useState } from "react";

import "./toggle-control.scss";

interface IProps {
  className?: string;
  dataTest?: string;
  initialValue?: boolean;
  onChange?: (value: boolean) => void;
  title?: string;
}

const ToggleControl: React.FC<IProps> = ({ className, dataTest, initialValue, onChange, title }) => {
  const [value, setValue] = useState(initialValue || false);

  const handleClick = () => {
    onChange?.(!value);
    setValue(!value);
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
