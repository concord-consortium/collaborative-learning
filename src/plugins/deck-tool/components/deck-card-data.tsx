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
  const [approved, setApproved] = useState(false);

  const caseHere = content.caseByIndex(caseIndex);
  const thisCase = caseHere ? caseHere : fakeCase;
  const attrs = Object.keys(thisCase).filter(attr => attr !== "__id__");

  console.log("1: thisCase: ", thisCase)
  function saveAndClearCandidate(str: string){
    console.log('2: save and clear candidate: ', str)
    content.setMottledGrayCaptureDate(str)
  }
  return (<>

    { attrs.map((attr) => {
      const attrName = content.attrById(attr).name;
      const attrValue = thisCase[attr];
      return (
        <div key={attr} className={`attribute-value-pair ${thisCase.__id__}`}>

          {/* attribute name or input */}
          <div className={`attribute name ${attr}`}>
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

          {/* attribute value or input  */}
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

