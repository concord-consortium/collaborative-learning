import { observer } from "mobx-react";
import classNames from "classnames";
import React, { useEffect, useState, useRef } from "react";
import { ToolTileModelType } from "../../../models/tools/tool-tile";
import { DeckContentModelType } from "../deck-content";
import { addAttributeToDataSet } from "../../../models/data/data-set";
import '../deck-tool.scss';

interface IProps {
  model: ToolTileModelType;
  caseId: string;
  attrKey: string;
  readOnly: any;
}


export const CaseAttribute: React.FC<IProps> = observer(({ model, caseId, attrKey, readOnly }) => {
  const content = model.content as DeckContentModelType;
  const [labelCandidate, setLabelCandidate] = useState("");
  const [valueCandidate, setValueCandidate] = useState("");
  const [isEditingFacet, setIsEditingFacet] = useState("");
  const [hasBeenSaved, setHasBeenSaved] = useState(false);
  const [attrsCount, setAttrsCount] = useState(content.existingAttributes().length);
  const [labelN, setLabelN] = useState(`Label ${attrsCount}`);

  useEffect(()=>{
    const initialValue = content.dataSet.getValue(caseId, attrKey);
    const initialLabel = content.dataSet.attrFromID(attrKey).name.length;
    const hasValue = initialValue !== undefined && initialValue !== "";
    const hasName = initialLabel > 0;
    setHasBeenSaved(hasValue || hasName)
  });

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (isEditingFacet === "name"){
      const inputVal = event.target.value;
      setLabelCandidate(inputVal);
      console.log("labelCandidate: ", labelCandidate);
    }
    if (isEditingFacet === "value"){
      const inputVal = event.target.value;
      setValueCandidate(inputVal);
      console.log("valueCandidate: ", valueCandidate);
    }
  };

  const handleKeyDown = (event:  React.KeyboardEvent<HTMLInputElement>) => {
    const { key } = event;
    if ( key === "Enter"){
      saveClear();
    }
  };

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const [facet, attr, status] = event.currentTarget.classList;
    console.log("handleClick: ",  facet, attr, status);
    activateInput(facet);
  }

  const handleDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const [facet, attr, status] = event.currentTarget.classList;
    console.log("handleDoubleClick: ",  facet, attr, status);

    // activateInput(facet);
  }

  const selectInput = (facet: string) => {
    console.log("select but do not activate input: ", facet);
  }

  const handleNameBlur = () => {
    if (labelCandidate === ""){
      console.log("we need to save a label name, and it should be: ", labelN);
      content.setAttName(attrKey, labelN);
      setIsEditingFacet("");
      setHasBeenSaved(true);
    }
     else {
      console.log("label name saveClear default")
      saveClear();
    }
  }

  const saveClear = () => {
    console.log("we are editing a: ", isEditingFacet);
    console.log("save value or label and clear: ", valueCandidate, labelCandidate);

    if (isEditingFacet === "name"){
      content.setAttName(attrKey, labelCandidate);
    }

    if (isEditingFacet === "value"){
      content.setAttValue(caseId, attrKey, valueCandidate);
    }
    setIsEditingFacet("");
    setHasBeenSaved(true);
  };

  const activateInput = (facet: string) => {
    setIsEditingFacet(facet);
    console.log("should activate input for facet: ", facet);

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
  }

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

  const ghostClassNames = classNames(
    "ghost", { "show": !hasBeenSaved, "hide": isEditingFacet !== "" }
  );

  return (
    <div className={pairClassNames}>
      <div className={labelClassNames} onDoubleClick={handleDoubleClick} onClick={handleClick}>
        {/* { !hasBeenSaved &&
          <div className={ghostClassNames}>{ labelN }</div>
        } */}
        { isEditingFacet === "name" || !hasBeenSaved
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

      <div className={valueClassNames} onDoubleClick={handleDoubleClick} onClick={handleClick}>
        { isEditingFacet === "value"
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

/* snippets

  const [labelCandidate, setLabelCandidate] = useState(content.attrById(attrKey).name);
  const [valueCandidate, setValueCandidate] = useState(content.dataSet.getValue(caseId, attrKey));

*/