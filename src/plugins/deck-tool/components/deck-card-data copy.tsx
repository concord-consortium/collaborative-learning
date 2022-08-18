import React, { useState, useEffect } from "react";
import { ToolTileModelType } from "../../../models/tools/tool-tile";
import { DeckContentModelType } from "../deck-content"

interface IProps {
  caseIndex: any;
  model: ToolTileModelType;
}

export const DeckCardData: React.FC<IProps> = ({ caseIndex, model }) => {
  console.log('render')
  const content = model.content as DeckContentModelType;
  const thisCase = content.caseByIndex(caseIndex);

  console.log("thisCase: ", thisCase);

  const [valueBeingEditedAttrId, setValueBeingEditedAttrId] = useState("")
  const [attributeBeingEditedId, setAttributeBeingEditedId] = useState("");

  const [newAttribute, setNewAttribute] = useState("");
  const [newValue, setNewValue] = useState("");

  // TODO what else FC<IProps> will accept as a return if I am to make this check
  if (!thisCase){
    return null;
  }

  function handleAttributeDoubleClick(e: any){
    // TODO, works because second class is attribute id,
    // could improve with a filter should these elements
    // get other classes dynamically from some other library or something
    setAttributeBeingEditedId(e.target.classList[1]);
  }

  function handleValueDoubleClick(e: any){
    setValueBeingEditedAttrId(e.target.classList[1]);
  }

  function handleNewAttrFocus(e:any){
    console.log('newAttr area in focus: ', e)
  }

  function handleAttrNameChange(e: any){
    console.log("handleAttrNameChange", e.target)
    //console.log("given the target value: ", e.target.classList[1])
    //console.log("change the name of the attribute with the id: ", "what here")
    content.setAttName("captureDate", "foozz")
  }

  function handleAttrNameKeyDown(e:any){
    const { key } = e;
    if ( key === "Enter"){
      setAttributeBeingEditedId("");
    }
  }

  function handleMottledGrayCaptureDateValueChange(e: any){
    console.log(e.target);
    content.setMottledGrayCaptureDate(e.target.value)
  }

  function getCaseData(myCase: any){
    console.log('running getCaseData')
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

  function getThisDangValue(){
    return content.dataSet.getValue("mottledGray", "captureDate")
  }

  return (
    <>
    <p><em>below is one iteration of a map over the data here for this case</em></p>
    <p>attribute name: { content.attrById("captureDate").name}</p>
    <p>attribute value: { thisCase?.captureDate}</p>
    <p>attribute value input:
      <input
        className={`attribute-input ${thisCase.__id__}`}
        value={getThisDangValue()}
        onChange={handleMottledGrayCaptureDateValueChange}
        //onKeyDown={handleAttrNameKeyDown}
        //onBlur={() => setAttributeBeingEditedId("")}
      />
    </p>
    </>
  )

  /*
  const caseData = getCaseData(thisCase);

  const caseHtml = caseData.map((dataPoint, i) => {
    if (!dataPoint){
      return;
    }

      const attrShowStaticText = dataPoint?.attributeName && dataPoint.attributeId !== attributeBeingEditedId;
    const valueShowStaticText = dataPoint?.attributeValue && dataPoint.attributeId !== valueBeingEditedAttrId;
    const modelAttrName = content.attrById(dataPoint.attributeId).name;

    return (
      <div className="case-item" key={i}>
        <div className={`attribute ${dataPoint?.attributeId}`} onDoubleClick={handleAttributeDoubleClick}>
          { attrShowStaticText
            ? dataPoint?.attributeName
            : <input
                className={`attribute-input ${dataPoint?.attributeId}`}
                value={modelAttrName}
                onChange={handleAttrNameChange}
                onKeyDown={handleAttrNameKeyDown}
                onBlur={() => setAttributeBeingEditedId("")}
              />
          }
        </div>
        <div className={`value ${dataPoint?.attributeId}`} onDoubleClick={handleValueDoubleClick}>
          { valueShowStaticText
            ? dataPoint?.attributeValue
            : <input />
          }
        </div>
      </div>
    )
  })

  return <>{caseHtml}</>
  */
  /*
  return (
    <>
      <b>{`foo`}</b>
    </>
  )
  */
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