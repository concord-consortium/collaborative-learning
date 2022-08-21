import { observer } from "mobx-react";
import classNames from "classnames";
import React, { useEffect, useState } from "react";
import { ToolTileModelType } from "../../../models/tools/tool-tile";
import { DeckContentModelType } from "../deck-content";
import '../deck-tool.scss';

interface IProps {
  model: ToolTileModelType;
  caseId: string;
  attrKey: string;
  readOnly: any;
  handleAttrsArray: () => void;
}

export const CaseAttribute: React.FC<IProps> = observer(({ model, caseId, attrKey, readOnly, handleAttrsArray }) => {
  const content = model.content as DeckContentModelType;
  const [labelCandidate, setLabelCandidate] = useState("");
  const [valueCandidate, setValueCandidate] = useState("");
  const [isEditingFacet, setIsEditingFacet] = useState("");
  const [hasBeenSaved, setHasBeenSaved] = useState(false);
  const [attrsCount, setAttrsCount] = useState(content.existingAttributes().length);
  const [labelN, setLabelN] = useState(`Label ${attrsCount}`);

  useEffect(()=>{
    // if this attribute has neither name nor value (besides "") it has not been saved
    // and will therefore appear as an input row
    const initialValue = content.dataSet.getValue(caseId, attrKey);
    const initialLabel = content.dataSet.attrFromID(attrKey).name.length;
    const hasValue = initialValue !== undefined && initialValue !== "";
    const hasName = initialLabel > 0;
    setHasBeenSaved(hasValue || hasName);
  },[content]);

  useEffect(()=>{
    // because of the above effect `hasBeenSaved` should only be changed
    // to "true" once in the existence of an attr row
    // as its id is persistent in dataSet - so we use that to
    // trigger creation of new, empty attribute
    if (hasBeenSaved === true){
      handleAttrsArray();
      //setAttrsCount(content.existingAttributes().length);
    }
  },[hasBeenSaved])

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (isEditingFacet === "name"){
      const inputVal = event.target.value;
      setLabelCandidate(inputVal);
    }
    if (isEditingFacet === "value"){
      const inputVal = event.target.value;
      setValueCandidate(inputVal);
    }
  };

  const handleKeyDown = (event:  React.KeyboardEvent<HTMLInputElement>) => {
    const { key } = event;
    if ( key === "Enter" || key === "Escape"){
      saveClear();
    }
  };

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const [facet] = event.currentTarget.classList;
    activateInput(facet);
  };

  const handleNameBlur = () => {
    if (labelCandidate === ""){
      content.setAttName(attrKey, labelN);
      setIsEditingFacet("");
      setHasBeenSaved(true);
    }
     else {
      saveClear();
    }
  };

  const saveClear = () => {
    if (isEditingFacet === "name"){
      content.setAttName(attrKey, labelCandidate);
    }

    if (isEditingFacet === "value"){
      content.setAttValue(caseId, attrKey, valueCandidate);
    }
    setIsEditingFacet("");
    setHasBeenSaved(true);
    setAttrsCount(content.existingAttributes().length);
  };

  const activateInput = (facet: string) => {
    setIsEditingFacet(facet);
    if (facet === "name"){
      setLabelCandidate(content.attrById(attrKey).name);
    }
    if (facet === "value"){
      const modelVal = content.dataSet.getValue(caseId, attrKey);
      if (modelVal){
        setValueCandidate(modelVal as string);
      } else {
        setValueCandidate("");
      }
    }
  };

  const pairClassNames = classNames(
    `attribute-name-value-pair ${attrKey}`,
    {"editing": isEditingFacet === "name" || "value"},
    hasBeenSaved ? "has-been-saved" : "not-saved"
  );

  const labelClassNames = classNames(
    `name ${attrKey}`,
    { "editing": isEditingFacet === "name"},
    hasBeenSaved ? "saved" : "unsaved"
  );

  const valueClassNames = classNames(
    `value ${attrKey}`,
    { "editing": isEditingFacet === "value"},
    hasBeenSaved ? "saved" : "unsaved"
  );

  return (
    <div className={pairClassNames}>
      <div className={labelClassNames} onClick={handleClick}>
        { !readOnly && isEditingFacet === "name" || !hasBeenSaved
          ? <input
              type="text"
              value={labelCandidate}
              placeholder={ hasBeenSaved ? "" : labelN}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onBlur={handleNameBlur}
            />
          : <div className="cell-value">{content.dataSet.attrFromID(attrKey).name}</div>
        }
      </div>

      <div className={valueClassNames} onClick={handleClick}>
        { isEditingFacet === "value" && !readOnly
          ? <input
              type="text"
              value={valueCandidate}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onBlur={saveClear}
            />
          : <div className="cell-value">{content.dataSet.getValue(caseId, attrKey)}</div>
        }
      </div>
    </div>
  );
});
