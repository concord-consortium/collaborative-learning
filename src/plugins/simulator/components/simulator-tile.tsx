import { observer } from "mobx-react";
import React, { useCallback, useEffect, useState } from "react";

import { ITileProps } from "../../../components/tiles/tile-component";
import { BasicEditableTileTitle } from "../../../components/tiles/basic-editable-tile-title";
import { isCurriculumDocument } from "../../../models/document/document-types";
import { SimulatorContentModelType } from "../model/simulator-content";
import { SimulatorVariable } from "./simulator-variable";

import "./simulator-tile.scss";

export const SimulatorTileComponent = observer(function SimulatorTileComponent({
  documentId, model, readOnly, onRegisterTileApi, tileElt
}: ITileProps) {
  // Note: capturing the content here and using it in handleChange() below may run the risk
  // of encountering a stale closure issue depending on the order in which content changes,
  // component renders, and calls to handleChange() occur. See the PR discussion at
  // (https://github.com/concord-consortium/collaborative-learning/pull/1222/files#r824873678
  // and following comments) for details. We should be on the lookout for such issues.
  const content = model.content as SimulatorContentModelType;
  const canRunIndependently = !readOnly || isCurriculumDocument(documentId);

  const [_steps, setSteps] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      if (canRunIndependently) {
        content?.step();
      }
      setSteps(v => v + 1);
    }, content.simulationData.delay);
    return () => clearInterval(id);
  }, [canRunIndependently, content]);

  const getNodeBoundingBox = useCallback((objectId: string) => {
    // Find the HTML object representing this node
    const elt = tileElt?.querySelector(`.node-${objectId}`);
    // console.log('tileElt', tileElt, 'elt:', elt, 'rect:', elt?.getBoundingClientRect());
    const tileRect = tileElt?.getBoundingClientRect();
    const nodeRect = elt?.getBoundingClientRect();
    if (tileRect && nodeRect) {
      return {
        left: nodeRect.left-tileRect.left,
        top: nodeRect.top-tileRect.top,
        width: nodeRect.width,
        height: nodeRect.height
      };
    } else {
      return undefined;
    }
  }, [tileElt]);

  useEffect(() => {
    onRegisterTileApi({
      getObjectBoundingBox: (objectId: string, objectType?: string) => {
        if (objectType === "node") {
          return getNodeBoundingBox(objectId);
        }
        return undefined;
      }
    });
  // We do need to redefine this if the tileElt changes (which it does once, from undefined on first render)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tileElt]);

  const component = content.simulationData.component;

  return (
    <div className="simulator-content-container">
      <BasicEditableTileTitle />
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
            { component({
              frame: _steps,
              variables: content.variables || [],
              programData: content.sharedProgramData
            }) }
          </div>
        )}
      </div>
    </div>
  );
});
