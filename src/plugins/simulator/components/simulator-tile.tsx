import { VariableType } from "@concord-consortium/diagram-view";
import { observer } from "mobx-react";
import React, { useEffect, useState } from "react";

import { SimulatorContentModelType } from "../model/simulator-content";
import { inputVariableNamePart, outputVariableNamePart } from "../../shared-variables/simulations/simulation-utilities";
import { ITileProps } from "../../../components/tiles/tile-component";
import { BasicEditableTileTitle } from "../../../components/tiles/basic-editable-tile-title";

import "./simulator-tile.scss";

export const SimulatorTileComponent = observer(function SimulatorTileComponent({ model, readOnly, scale }: ITileProps) {
  // Note: capturing the content here and using it in handleChange() below may run the risk
  // of encountering a stale closure issue depending on the order in which content changes,
  // component renders, and calls to handleChange() occur. See the PR discussion at
  // (https://github.com/concord-consortium/collaborative-learning/pull/1222/files#r824873678
  // and following comments) for details. We should be on the lookout for such issues.
  const content = model.content as SimulatorContentModelType;

  const [_steps, setSteps] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      content?.step();
      setSteps(v => v + 1);
    }, content.simulationData.delay);
    return () => clearInterval(id);
  }, [content]);

  interface IVariableRowProps {
    key?: string;
    nameFunction?: (v: VariableType) => string | undefined;
    variable?: VariableType;
  }
  const VariableRow = ({ nameFunction, variable }: IVariableRowProps) => {
    const defaultFunction = (v: VariableType) => v.name || "";
    const _nameFunction = nameFunction ?? defaultFunction;

    // Limit the value to two decimal places
    const value = variable?.value;
    const scaleFactor = 100;
    const displayValue = value !== undefined ? Math.round(value * scaleFactor) / scaleFactor : "";
    const display = variable?.name ? `${_nameFunction(variable)}: ${displayValue}` : "";
    return (
      <p>
        {display}
      </p>
    );
  };

  const displayName = (
    nameFunction: (v: VariableType) => string | undefined, suffix: string, variable: VariableType
  ) => {
    return variable?.name ? `${nameFunction(variable)} ${suffix}` : "";
  };

  const inputDisplayName = (v: VariableType) => displayName(inputVariableNamePart, "Sensor", v);
  const outputDisplayName = (v: VariableType) => displayName(outputVariableNamePart, "Output", v);

  return (
    <div className="simulator-content-container">
      <BasicEditableTileTitle
        model={model}
        readOnly={readOnly}
        scale={scale}
      />
      <div className="simulator-content">
        <div className="simulator-variables">
          { content.inputVariables.map(variable =>
            <VariableRow
              key={variable.name}
              nameFunction={inputDisplayName}
              variable={content.getVariable(variable.name)}
            />
          )}
          { content.outputVariables.map(variable =>
            <VariableRow
              key={variable.name}
              nameFunction={outputDisplayName}
              variable={content.getVariable(variable.name)}
            />
          )}
        </div>
      </div>
    </div>
  );
});
