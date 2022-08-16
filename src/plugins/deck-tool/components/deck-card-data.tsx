import React, { useState, useEffect } from "react";
import { ToolTileModelType } from "../../../models/tools/tool-tile";
import { DeckContentModelType } from "../deck-content"

interface IProps {
  caseIndex: any;
  model: ToolTileModelType;
}

export const DeckCardData: React.FC<IProps> = ({ caseIndex, model }) => {
  const content = model.content as DeckContentModelType;
  const thisCase = content.caseByIndex(caseIndex);

  const [valueBeingEditedAttrId, setDataPointBeingEdited] = useState("")
  const [attributeBeingEditedId, setAttributeBeingEdited] = useState("");

  const [newAttribute, setNewAttribute] = useState("");
  const [newValue, setNewValue] = useState("");

  // TODO what else FC<IProps> will accept as a return if I am to make this check
  if (!thisCase){
    return null;
  }

  function handleAttributeDoubleClick(e: any){
    console.log('attribute was double clicked: ', e.target)
  }

  function handleValueClick(e: any){
    console.log('value was clicked: ', e)
  }

  function handleNewAttrFocus(e:any){
    console.log('newAttr area in focus: ', e)
  }
  function getCaseData(myCase: any){
    const keysHere = Object.keys(myCase).filter(keyName => keyName !== "__id__");
    const caseData = keysHere.map((keyName) => {
      const attrName = content.attrById(keyName).name;
      return thisCase
        ? {
            caseId: thisCase.__id__,
            attributeName: attrName,
            attributeId: keyName,
            attributeValue: thisCase[keyName]
          }
        : undefined;
    });
    return caseData;
  }
  const caseData = getCaseData(thisCase);

  const caseHtml = caseData.map((dataPoint, i) => {
    const attrShowStaticText = dataPoint?.attributeName && dataPoint.attributeId !== attributeBeingEditedId;
    const valueShowStaticText = dataPoint?.attributeValue && dataPoint.attributeId !== valueBeingEditedAttrId;
    return (
      <div className="case-item" key={i}>
        <div className={`attribute ${dataPoint?.attributeId}`} onDoubleClick={handleAttributeDoubleClick}>
          { attrShowStaticText
            ? <>{dataPoint?.attributeName}</>
            : <input width="100"/>
          }
        </div>
        <div className="value">
          { valueShowStaticText
            ? dataPoint?.attributeValue
            : <input />
          }
        </div>
      </div>
    )
  })

  return <>{caseHtml}</>
};

/*


      <div className="case-item" key={i}>
        <div className={`attribute ${dataPoint?.attributeId}`} onDoubleClick={handleAttributeDoubleClick}>
          { dataPoint && true
            ? <span className={`attribute-text `}>{dataPoint?.attributeName}</span>
            : <input width="100"/>
          }

        </div>
        <div className={`value-of ${dataPoint?.attributeId}`}>
          {dataPoint?.attributeValue}
        </div>
      </div>

*/