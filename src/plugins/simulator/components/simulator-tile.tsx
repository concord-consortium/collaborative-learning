import { observer } from "mobx-react";
import React, { useEffect, useState } from "react";

import { SimulatorVariable } from "./simulator-variable";
import { SimulatorContentModelType } from "../model/simulator-content";
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

  const component = content.simulationData.component;

  return (
    <div className="simulator-content-container">
      <BasicEditableTileTitle readOnly={readOnly} />
      <div className="simulator-content">
        <div className="simulator-variables">
          { content.inputVariables.map(variable =>
            <SimulatorVariable
              key={variable.name}
              variable={content.getVariable(variable.name)}
            />
          )}
          { content.outputVariables.map(variable =>
            <SimulatorVariable
              key={variable.name}
              variable={content.getVariable(variable.name)}
            />
          )}
        </div>
        { component && (
          <div className="simulator-component-container">
            { component({ frame: _steps, variables: content.variables || [] }) }
          </div>
        )}
      </div>
    </div>
  );
});
