import React from "react";

import "./raw-settings-control.scss";

interface RawSettingsControlProps {
  initialValue: object;
}

const RawSettingsControl: React.FC<RawSettingsControlProps> = ({ initialValue }) => {
  return (
    <textarea className="raw-settings-control" value={JSON.stringify(initialValue, null, 2)} />
  );
};

export default RawSettingsControl;
