import { observer } from "mobx-react";
import React, { useState, useEffect } from "react";
import { ToolTileModelType } from "../../../models/tools/tool-tile";
import { DeckContentModelType } from "../deck-content";
import { CaseAttribute } from "./case-attribute";

interface IProps {
  caseIndex: any;
  model: ToolTileModelType;
  totalCases: number;
  readOnly: any; // TODO - find the correct type or pattern for this
}

export const DeckCardData: React.FC<IProps> = observer(({ caseIndex, model, totalCases, readOnly }) => {
  const content = model.content as DeckContentModelType;
  const [currentCaseId, setCurrentCaseId] = useState("");
  const [attrKeys, setAttrKeys] = useState(content.existingAttributes());

  useEffect(()=>{
    setCurrentCaseId(() => {
      return content.caseByIndex(caseIndex)?.__id__ || "no_id";
    });
  }, [caseIndex]);

  const makeNewAtt = () => {
    content.addNewAtt();
  }

  return (
    <>
      <button onClick={makeNewAtt}>Make new att</button>
      { attrKeys.map((attrKey) => {
          return <CaseAttribute key={attrKey} model={ model } caseId={ currentCaseId } attrKey={attrKey} readOnly={readOnly} />
        })
      }
    </>
  );
});