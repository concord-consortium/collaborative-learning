import { observer } from "mobx-react";
import React, { useEffect, useState, useRef } from "react";
import { ToolTileModelType } from "../../../models/tools/tool-tile";
import { DeckContentModelType } from "../deck-content";
import { addAttributeToDataSet } from "../../../models/data/data-set";
import '../deck-tool.scss';

interface IProps {
  caseIndex: any;
  model: ToolTileModelType;
  readOnly: any;
}

export const NewCardAttribute: React.FC<IProps> = observer(({ caseIndex, model, readOnly }) => {
  const content = model.content as DeckContentModelType;
  const [attrNameCandidate, setAttrNameCandidate] = useState("");
  const [valCandidate, setValCandidate] = useState("");
  const [attrsCount, setAttrsCount] = useState(content.existingAttributes().length);
  const attrId = useRef("");

  useEffect(()=>{
    if (attrId.current === ""){
      console.log("no attr in play, lets set it.");
      setUpNewAttr();
    } else {
      console.log("existing attr being worked on");
    }

  });

  function setUpNewAttr(){
    const nextLabel = `Label ${attrsCount + 1}`;
    console.log("ok, here is nextLabel: ", nextLabel);

    // addAttributeToDataSet(content.dataSet, { name: nextLabel });
    //setAttrsCount(content.existingAttributes().length);
  }

  const handleAttrNameCandidateInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setAttrNameCandidate(event.target.value);
  };

  const handleAttrCandidateKeyDown = (event:  React.KeyboardEvent<HTMLInputElement>) => {
    const { key } = event;
    if ( key === "Enter"){
      attrNameSaveClear();
    }
  };

  const attrNameSaveClear = () => {
    console.log('attr save - candidate: ', attrNameCandidate);
  };

  const handleValCandidateInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setValCandidate(event.target.value);
  };

  const handleValCandidateKeyDown = (event:  React.KeyboardEvent<HTMLInputElement>) => {
    const { key } = event;
    if ( key === "Enter"){
      valSaveClear();
    }
  };

  const valSaveClear = () => {
    console.log("val save - candidate: ", valCandidate);
  };

  return (
    <div className="add-attribute-area">
      <div className="new-attribute" style={{color: "silver"}}>
        <input
          type="text"
          value={attrNameCandidate || ""}
          onChange={handleAttrNameCandidateInputChange}
          onKeyDown={handleAttrCandidateKeyDown}
          onBlur={attrNameSaveClear}
        />
      </div>
      <div className="new-value"style={{color: "silver"}}>
        <input
          type="text"
          value={valCandidate || ""}
          onChange={handleValCandidateInputChange}
          onKeyDown={handleValCandidateKeyDown}
          onBlur={valSaveClear}
        />
      </div>
    </div>
  );
});

