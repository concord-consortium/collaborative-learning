import { observer } from "mobx-react";
import React, { useState, useEffect, useMemo } from "react";
import { ToolTileModelType } from "../../../models/tools/tool-tile";
import { DeckContentModelType } from "../deck-content"
import { NewCardAttribute } from "./new-card-attribute"

interface IProps {
  caseIndex: any;
  model: ToolTileModelType;
  totalCases: number;
}

export const DeckCardData: React.FC<IProps> = observer(({ caseIndex, model, totalCases }) => {
  const content = model.content as DeckContentModelType;
  const [activeAttrId, setActiveAttrId] = useState("");
  const [activeFacet, setActiveFacet] = useState("");
  const [candidate, setCandidate] = useState("");
  const [currentCaseId, setCurrentCaseId] = useState("");
  const [currentCaseObj, setCurrentCaseObj] = useState({});
  const [attrKeys, setAttrKeys] = useState(["label1"]);

  useEffect(()=>{
    setCurrentCaseId(() => {
      return content.caseByIndex(caseIndex)?.__id__ || "no_id"
    })
  }, [caseIndex])

  useEffect(()=>{
    const raw = content.caseByIndex(caseIndex);
    const filteredKeys = raw ? Object.keys(raw).filter(k => k !== "__id__") : ["label1"];
    setAttrKeys(filteredKeys);
  },[model])

  return (
    <>
      { attrKeys.map((a) => {
        return (
          <div key={a} className={`attribute-name-value-pair ${currentCaseId}`}>
            <div className={`name ${a}`}>{ content.dataSet.attrFromID(a).name}</div>
            <div className={`value ${a}`}>{content.dataSet.getValue(currentCaseId, a ) }</div>
          </div>
        )
      })}
       <NewCardAttribute model={model} currentCaseIndex={caseIndex}/>
    </>
  )


})

