import { observer } from "mobx-react";
import React, { useEffect, useRef, useState } from "react";

import { ITileProps } from "../../../components/tiles/tile-component";
import { BasicEditableTileTitle } from "../../../components/tiles/basic-editable-tile-title";
import { isCurriculumDocument } from "../../../models/document/document-types";
import { SimulatorContentModelType } from "../model/simulator-content";
import { SimulatorVariable } from "./simulator-variable";
import { OffsetModel } from "../../../models/annotations/clue-object";
import { getPinBoundingBox, setPinOffsets } from "../simulations/potentiometer-servo/chip-sim-utils";

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
  const simRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    onRegisterTileApi({
      getObjectBoundingBox: (objectId: string, objectType?: string) => {
        // miniNode bounding boxes are not defined here, since
        // they get updated via cacheObjectBoundingBox.
        if (!tileElt) return undefined;
        switch (objectType) {
          case "pin":
            return getPinBoundingBox(objectId, tileElt);
          default:
            return undefined;
        }
      },
      getObjectDefaultOffsets: (objectId: string, objectType?: string) => {
        // Set Pin arrows to attach to the outer edge by default.
        const offsets = OffsetModel.create({});
        if (objectType === "pin") {
          setPinOffsets(objectId, offsets);
        }
        return offsets;
      }
    });
  // We do need to redefine this if the tileElt changes (which it does once, from undefined on first render)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tileElt]);

  const component = content.simulationData.component;

  return (
    <div ref={simRef} className="tile-content simulator-content-container">
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
              tileElt,
              simRef,
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
