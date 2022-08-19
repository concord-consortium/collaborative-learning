import { observer } from "mobx-react";
import React, { useState } from "react";
import { ToolTileModelType } from "../../../models/tools/tool-tile";
import { DeckContentModelType } from "../deck-content";

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
  const [isEditingAttr, setIsEditingAttr] = useState(true);
  const [isEditingVal, setIsEditingVal] = useState(false);
  const [labelNumber, setLabelNumber] = useState(content.existingAttributes().length)
  const [newAttrId, setNewAttrId] = useState("");

  const handleAttrNameCandidateInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setAttrNameCandidate(event.target.value)
  }

  const handleAttrCandidateKeyDown = (event:  React.KeyboardEvent<HTMLInputElement>) => {
    const { key } = event;
    if ( key === "Enter"){
      attrNameSaveClear();
    }
  }

  const attrNameSaveClear = () => {
    console.log('save the new attribute and collect its id to state');
  }

  const handleValCandidateInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setValCandidate(event.target.value);
  }

  const handleValCandidateKeyDown = (event:  React.KeyboardEvent<HTMLInputElement>) => {
    const { key } = event;
    if ( key === "Enter"){
      valSaveClear();
    }
  }

  const valSaveClear = () => {
    console.log("hold onto candidate value, but secretly, if this is first entry, create new attr and collect its id");
  }

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

