import { observer } from "mobx-react";
import classNames from "classnames";
import React, { useState, useEffect } from "react";
import { ToolTileModelType } from "../../../models/tools/tool-tile";
import { DeckContentModelType } from "../deck-content";
import { NewCardAttribute } from "./new-card-attribute";


interface IProps {
  caseIndex: any;
  model: ToolTileModelType;
  totalCases: number;
  readOnly: any; // TODO - find the correct type or pattern for this
}

export const DeckCardData: React.FC<IProps> = observer(({ caseIndex, model, totalCases, readOnly }) => {
  const content = model.content as DeckContentModelType;
  const [activeAttrId, setActiveAttrId] = useState("");
  const [activeFacet, setActiveFacet] = useState("");
  const [candidate, setCandidate] = useState("");
  const [currentCaseId, setCurrentCaseId] = useState("");
  const [attrKeys, setAttrKeys] = useState(content.existingAttributes());
  const [readyForNewAttribute, setReadyForNewAttribute] = useState(false);

  useEffect(()=>{
    setCurrentCaseId(() => {
      return content.caseByIndex(caseIndex)?.__id__ || "no_id";
    });
  }, [caseIndex]);

  // lets start by basing things off existing attr keys
  useEffect(() => {
    console.log('use me!')
  })

  useEffect(()=>{
    console.log("use effect of model")
    // unless we are on a brand new deck with no attr names or values, we'll see the new att area
    const firstCase = content.dataSet.getCanonicalCaseAtIndex(0);
    const valLength = (firstCase?.label1 as string).length;
    const nameLength = content.dataSet.attrFromID("label1").name.length;
    setReadyForNewAttribute(valLength + nameLength > 0);

    // collect our keys first
    const raw = content.caseByIndex(caseIndex);
    const filteredKeys = raw ? Object.keys(raw).filter(k => k !== "__id__") : ["label1"];
    setAttrKeys(filteredKeys);
  },[model]);

  const handleCandidateInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setCandidate(event.target.value);
  };

  const handleCandidateKeyDown = (event:  React.KeyboardEvent<HTMLInputElement>) => {
    const { key } = event;
    if ( key === "Enter"){
      saveClear();
    }
  };

  function activateInput(e:any){
    const attrToEdit = (e.target.classList[1]);
    const facetToEdit = (e.target.classList[0]);

    if (facetToEdit === "name"){
      setActiveFacet(facetToEdit);
      setActiveAttrId(attrToEdit);
      setCandidate(content.attrById(attrToEdit).name);
    }
    if (facetToEdit === "value"){
      setActiveFacet(facetToEdit);
      setActiveAttrId(attrToEdit);
      const currentVal = content.dataSet.getValue(currentCaseId, attrToEdit);
      setCandidate(currentVal as string);
    }
  }

  const saveClear = () => {
    if (activeFacet === "value"){
      content.setAttValue(currentCaseId, activeAttrId, candidate);
      setCandidate("");
    } else if (activeFacet === "name") {
      content.setAttName(activeAttrId, candidate);
      setCandidate("");
    }
    setActiveFacet("");
    setActiveAttrId("");
    setReadyForNewAttribute(true);
  };

  const pairClassNames = classNames(
    "attribute-name-value-pair", `${currentCaseId}`,
    { singleattr: content.existingAttributes().length === 1 && !readyForNewAttribute }
  );

  return (
    <>
      { attrKeys.map((a) => {
        return (
          <div key={a} className={pairClassNames}>
            <div className={`name ${a}`} onDoubleClick={activateInput}>
              { activeAttrId === a && activeFacet === "name" && !readOnly
                ? <input
                    className="candidate-input"
                    placeholder="label 1"
                    key={`${a}_name`}
                    type="text"
                    value={candidate}
                    onChange={handleCandidateInputChange}
                    onKeyDown={handleCandidateKeyDown}
                    onBlur={saveClear}
                  />
                : content.dataSet.attrFromID(a).name
              }
            </div>

            <div className={`value ${a}`} onDoubleClick={activateInput}>
              { activeAttrId === a && activeFacet === "value" && !readOnly
                ? <input
                    className="candidate-input"
                    key={`${a}_value`}
                    type="text"
                    value={candidate || ""}
                    onChange={handleCandidateInputChange}
                    onKeyDown={handleCandidateKeyDown}
                    onBlur={saveClear}
                  />
                : content.dataSet.getValue(currentCaseId, a)
              }
            </div>
          </div>
        );
      })}

      { readyForNewAttribute &&
        <NewCardAttribute model={model} caseIndex={caseIndex} readOnly={readOnly} />
      }

    </>
  );
});

