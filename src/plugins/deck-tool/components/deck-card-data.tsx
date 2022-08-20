import { observer } from "mobx-react";
import React, { useState, useEffect, useMemo } from "react";
import { ToolTileModelType } from "../../../models/tools/tool-tile";
import { DeckContentModelType } from "../deck-content";
import { NewCardAttribute } from "./new-card-attribute";

interface IProps {
  activeFacet: null | "name" | "value";
  caseIndex: any;
  model: ToolTileModelType;
  onSetActiveFacet: (facet: null | "name" | "value") => void;
}

const fakeCase = Object({ __id__: "fake", fakeAttribute: "something" });

export const DeckCardData: React.FC<IProps> = observer(({ caseIndex, model, activeFacet, onSetActiveFacet }) => {
  const content = model.content as DeckContentModelType;
  const [activeAttrId, setActiveAttrId] = useState("");
  // const [activeFacet, setActiveFacet] = useState<null | "name" | "value">(null);
  const [candidate, setCandidate] = useState("");
  const [isEditingNewCard, setIsEditingNewCard] = useState(false); //may not need this
  // const [approved, setApproved] = useState(false); ToDO - does saving need a more explicit approval?

  const caseHere = content.caseByIndex(caseIndex);
  const thisCase = caseHere ? caseHere : fakeCase;
  const attrs = Object.keys(thisCase).filter(attr => attr !== "__id__");

  function saveAndClearCandidate(str: string){
    if (activeFacet === "value"){
      content.setAttValue(thisCase.__id__, activeAttrId, candidate);
    } else if (activeFacet === "name") {
      content.setAttName(activeAttrId, candidate);
    }
    onSetActiveFacet(null);
    setActiveAttrId("");
  }

  function setCandidateAndActiveInput(e:any){

    // console.log("activeAttrId: ", activeAttrId)
    // console.log("activeFacet: ", activeFacet)
    // // already editing, ignore double clicks here
    // if ( activeFacet === "name" || "value"){
    //   return;
    // }

    // user clicked on an attr's name facet or value facet
    const attrToEdit = e.target.classList[1];
    const facetToEdit = e.target.classList[0];

    // const currentVal = content.dataSet.getValue(thisCase.__id__, attrToEdit);
    // console.log("currentVal: ", currentVal);

    if (facetToEdit === "name" ||  facetToEdit === "value"){
      // open input where we have clicked
      onSetActiveFacet(facetToEdit);
      setActiveAttrId(attrToEdit);

      // look up the existing name or value and set the candidate to that string
      if (facetToEdit === "name"){
        setCandidate(content.attrById(attrToEdit).name);
      }

      if (facetToEdit === "value"){
        const currentVal = content.dataSet.getValue(thisCase.__id__, attrToEdit);
        setCandidate(currentVal as string);
      }
    }

  }

  return (
    <>
      { attrs.map((attr) => {
        const attrName = content.attrById(attr).name;
        const attrValue = thisCase[attr];
        return (
          <div key={attr} className={`attribute-name-value-pair ${thisCase.__id__}`}>

            {/* attribute name render || input */}
            <div
              className={`name ${attr}`}
              onDoubleClick={setCandidateAndActiveInput}
            >
              { activeAttrId === attr && activeFacet === "name"
                ? <input
                             value={candidate}
                    onChange={(e:any) => setCandidate(e.target.value)}
                    onBlur={() => saveAndClearCandidate(candidate)}
                  />
                : attrName
              }
            </div>

            {/* attribute value render || input  */}
            <div
              className={`value ${attr}`}
              onDoubleClick={setCandidateAndActiveInput}
            >
              { activeAttrId === attr && activeFacet === "value"
                ? <input
                    type="text"
                    value={candidate}
                    onChange={(e:any) => setCandidate(e.target.value)}
                    onBlur={() => saveAndClearCandidate(candidate)}
                  />
                : attrValue
              }
            </div>
          </div>
        );
      })}

      <NewCardAttribute model={model} currentCaseIndex={caseIndex}/>
    </>
  );

});
