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

  const keysHere = Object.keys(thisCase).filter(k => k !== "__id__");
  const caseData = keysHere.map((k) => {
    const attrName = content.attrById(k).name;
    return thisCase ? { a: attrName, v: thisCase[k]} : undefined;
  });

  const caseHtml = caseData.map((caseDataPoint, i) => {
    return (
      <div className="case-item" key={i}>
        <div className="attribute"><b>{caseDataPoint?.a}</b></div>
        <div className="value">{caseDataPoint?.v}</div>
      </div>
    )
  })

  return (<>{caseHtml}</>)
};

