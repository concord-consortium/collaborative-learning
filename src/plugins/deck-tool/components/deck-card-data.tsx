import React from "react";
import { ToolTileModelType } from "../../../models/tools/tool-tile";
import { DeckContentModelType } from "../deck-content"

interface IProps {
  caseIndex: any;
  model: ToolTileModelType;
}

export const DeckCardData: React.FC<IProps> = ({ caseIndex, model }) => {
  const content = model.content as DeckContentModelType;
  const thisCase = content.caseByIndex(caseIndex);

  // TODO what else FC<IProps> will accept as a return if I am to make this check
  if (!thisCase){
    return null;
  }

  const keysHere = Object.keys(thisCase).filter(keyName => keyName !== "__id__");
  const caseData = keysHere.map((keyName) => {
    const attrName = content.attrById(keyName).name;
    return thisCase ? { attributeName: attrName, attributeValue: thisCase[keyName]} : undefined;
  });

  const caseHtml = caseData.map((caseDataPoint, i) => {
    console.log(caseDataPoint)
    return (
      <div className="case-item" key={i}>
        <div className="attribute"><b>{caseDataPoint?.attributeName}</b></div>
        <div className="value">{caseDataPoint?.attributeValue}</div>
      </div>
    )
  })

  return <>{caseHtml}</>
};

