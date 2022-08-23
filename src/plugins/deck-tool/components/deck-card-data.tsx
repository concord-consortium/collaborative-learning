import { observer } from "mobx-react";
import React, { useState, useEffect } from "react";
import { ToolTileModelType } from "../../../models/tools/tool-tile";
import { DeckContentModelType } from "../deck-content";
import { CaseAttribute } from "./case-attribute";

interface IProps {
  caseIndex: any;
  model: ToolTileModelType;
  totalCases: number;
  readOnly: any;
  imageUrlToAdd?: string;
  onSetSelectedCell: (caseId: string, attrKey: string) => void;
}

export const DeckCardData: React.FC<IProps> = observer(({ caseIndex, model, readOnly, imageUrlToAdd,
    onSetSelectedCell }) => {
  const content = model.content as DeckContentModelType;
  const [currentCaseId, setCurrentCaseId] = useState("");
  const [attrKeys, setAttrKeys] = useState(content.existingAttributes());

  useEffect(()=>{
    setCurrentCaseId(() => {
      return content.caseByIndex(caseIndex)?.__id__ || "no_id";
    });
  }, [caseIndex]);

  const createEmptyAttr = () => {
    content.addNewAttr();
    setAttrKeys(content.existingAttributes);
  };

  return (
    <>
      {/* <button style={{ position: "absolute", bottom: "100px" }}onClick={makeNewAttr}>Make new attr</button> */}
      { attrKeys.map((attrKey) => {
          return (
            <CaseAttribute
              key={attrKey}
              model={model}
              caseId={currentCaseId}
              attrKey={attrKey}
              readOnly={readOnly}
              imageUrlToAdd={imageUrlToAdd}
              createEmptyAttr={createEmptyAttr}
              onSetSelectedCell={onSetSelectedCell}
            />
          );
        })
      }
    </>
  );
});
