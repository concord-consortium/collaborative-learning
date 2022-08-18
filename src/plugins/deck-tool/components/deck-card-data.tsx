import { observer } from "mobx-react";
import React, { useState, useEffect, useMemo } from "react";
import { ToolTileModelType } from "../../../models/tools/tool-tile";
import { DeckContentModelType } from "../deck-content"

interface IProps {
  caseIndex: any;
  model: ToolTileModelType;
}

let fakeCase = Object({ __id__: "fake", fakeAttribute: "something" });

export const DeckCardData: React.FC<IProps> = observer(({ caseIndex, model }) => {
  const content = model.content as DeckContentModelType;
  const [activeAttrId, setActiveAttrId] = useState("");
  const [activeFacet, setActiveFacet] = useState<null | "name" | "value">(null);
  const [candidate, setCandidate] = useState("");
  // const [approved, setApproved] = useState(false); ToDO - does saving need a more explicit approval?

  const caseHere = content.caseByIndex(caseIndex);
  const thisCase = caseHere ? caseHere : fakeCase;
  const attrs = Object.keys(thisCase).filter(attr => attr !== "__id__");

  console.log("1: thisCase: ", thisCase)

  function saveAndClearCandidate(str: string){
    if (activeFacet === "value"){
      content.setAttValue(thisCase.__id__, activeAttrId, candidate);
    } else if (activeFacet === "name") {
      content.setAttName(activeAttrId, candidate);
    }
    setActiveFacet(null);
    setActiveAttrId("");
  }

  function setCandidateAndActiveInput(e:any){
    // user clicked on an attr's name facet or value facet
    const attrToEdit = e.target.classList[1];
    const facetToEdit = e.target.classList[0];

    const currentVal = content.dataSet.getValue(thisCase.__id__, attrToEdit);
    console.log("currentVal: ", currentVal);

    if (facetToEdit === "name" || "value"){
      // open input where we have clicked
      setActiveFacet(facetToEdit);
      setActiveAttrId(attrToEdit);

      // set the ephemeral candidate value
      // const newCandidate = facetToEdit === "name"
      //   ? content.attrById(attrToEdit)
      //   : content.dataSet.getValue(thisCase.__id__, attrToEdit);

      // setCandidate(newCandidate);
      // look up the existing value and set the candidate to that existing value
      if (facetToEdit === "name"){
        setCandidate(content.attrById(attrToEdit).name)
      }

      if (facetToEdit === "value"){
        const currentVal = content.dataSet.getValue(thisCase.__id__, attrToEdit);
        setCandidate(currentVal as string);
      }
    }

    console.log(e.target.classList)

    // where did we click? get that value and make it candidate
    // render the input by doing
    //   setActiveFacet(where clicked facet)
    //   setActiveAttrId(where clicked id)
    //   setCandidate(value in location clicked)
  }

  return (<>

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
                  type="text"
                  value={candidate}
                  onChange={(e:any) => setCandidate(e.target.value)}
                  onBlur={() => {saveAndClearCandidate(candidate)}}
                />
              : attrName
            }
          </div>

          {/* attribute value render || input  */}
          <div className={`value ${attr}`}>
            { activeAttrId === attr && activeFacet === "value"
              ? <input
                  type="text"
                  value={candidate}
                  onChange={(e:any) => setCandidate(e.target.value)}
                  onBlur={() => {saveAndClearCandidate(candidate)}}
                />
              : attrValue
            }
          </div>
        </div>
      )
    })}

  </>)

})

