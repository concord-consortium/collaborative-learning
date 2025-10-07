import React from "react";

import { useCurriculum } from "../../hooks/use-curriculum";

import "./raw-settings-control.scss";

const RawSettingsControl: React.FC = () => {
  const { unitConfig} = useCurriculum();
  return (
    <textarea className="raw-settings-control" value={JSON.stringify(unitConfig, null, 2)} />
  );
};

export default RawSettingsControl;
