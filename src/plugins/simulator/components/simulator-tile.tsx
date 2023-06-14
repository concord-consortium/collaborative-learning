import { VariableType } from "@concord-consortium/diagram-view";
import { observer } from "mobx-react";
import React, { useEffect, useState } from "react";

import { SimulatorContentModelType } from "../model/simulator-content";
import { ITileProps } from "../../../components/tiles/tile-component";

import "./simulator-tile.scss";

export const SimulatorToolComponent: React.FC<ITileProps> = observer((props) => {
  // Note: capturing the content here and using it in handleChange() below may run the risk
  // of encountering a stale closure issue depending on the order in which content changes,
  // component renders, and calls to handleChange() occur. See the PR discussion at
  // (https://github.com/concord-consortium/collaborative-learning/pull/1222/files#r824873678
  // and following comments) for details. We should be on the lookout for such issues.
  const content = props.model.content as SimulatorContentModelType;

  const [steps, setSteps] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      content?.step();
      setSteps(v => v + 1);
    }, content.simulationData.delay);
    return () => clearInterval(id);
  }, [content]);

  const displayVariables = content.simulationData.variables;

  interface IVariableRowProps {
    key?: string;
    variable?: VariableType;
  }
  const VariableRow = ({ variable }: IVariableRowProps) => {
    const display = variable ? `${variable.name}: ${variable.value?.toFixed(2)}` : "";
    return (
      <p>
        {display}
      </p>
    );
  };

  return (
    <>
      <h3>Wow a simulator tile!</h3>
      {displayVariables.map(
        variable => <VariableRow variable={content?.getVariable(variable.name)} key={variable.name} />
      )}
    </>
  );
});
SimulatorToolComponent.displayName = "SimulatorToolComponent";
