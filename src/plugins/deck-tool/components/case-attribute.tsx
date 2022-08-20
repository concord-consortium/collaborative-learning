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

/* tasks

  [ ] reimplement cards crud
  [ ] add create of new attributes
  [ ] hover stuff
  [ ] modal?

  save snippets:
  content.setAttValue(caseId, attrKey, value);
  content.setAttName(activeAttrId, label);

*/
export const CaseAttribute: React.FC<IProps> = observer(({ model, caseId, attrKey, readOnly }) => {
  const content = model.content as DeckContentModelType;
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [isEditingValue, setIsEditingValue] = useState(false)
  const [hasBeenSaved, setHasBeenSaved] = useState(false);
  const [attrsCount, setAttrsCount] = useState(content.existingAttributes().length);
  const [labelN, setLabelN] = useState(`Label ${attrsCount}`)

  useEffect(()=>{
    console.log('main effect on Attribute component');
  });

  const labelChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setLabel(event.target.value);
    console.log('label change: ', label);
  };

  const labelKeyDown = (event:  React.KeyboardEvent<HTMLInputElement>) => {
    const { key } = event;
    if ( key === "Enter"){
      labelSave();
    }
  };

  const labelSave = () => {
    console.log('label save: ', label);
    setHasBeenSaved(true);
  };

  const valueChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setValue(event.target.value);
    console.log('value change: ', value);
    setAttrsCount(content.existingAttributes().length);
  };

  const valueKeyDown = (event:  React.KeyboardEvent<HTMLInputElement>) => {
    const { key } = event;
    if ( key === "Enter"){
      valueSave();
    }
  };

  const activateNameInput = () => {
    setIsEditingValue(false);
    setIsEditingLabel(true);
  }

  const activateValueInput = () => {
    setIsEditingLabel(false);
    setIsEditingValue(true);
  }

  const valueSave = () => {
    setHasBeenSaved(true);
    console.log("val save: ", value);
    setAttrsCount(content.existingAttributes().length);
  };

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const [facet, attr, status] = event.currentTarget.classList;
    console.log("handleClick: ",  facet, attr, status);
  }

  const handleDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const [facet, attr, status] = event.currentTarget.classList;
    console.log("handleDoubleClick: ",  facet, attr, status);
  }

  const pairClassNames = classNames(
    "attribute-name-value-pair",
    `${attrKey}`,
    { "editing editing-label": isEditingLabel},
    { "editing editing-value": isEditingValue},
    hasBeenSaved ? "has-been-saved" : "not-saved"
  );

  const labelClassNames = classNames(
    `name ${attrKey}`,
    { "editing": isEditingLabel},
    hasBeenSaved ? "saved" : "unsaved"
  )

  const valueClassNames = classNames(
    `value ${attrKey}`,
    { "editing": isEditingValue},
    hasBeenSaved ? "saved" : "unsaved"
  )

  return (
    <div className={pairClassNames}>
      <div className={labelClassNames} onDoubleClick={handleDoubleClick} onClick={handleClick}>
        { !hasBeenSaved &&
          <div className="ghost ghost-name">{ labelN }</div>
        }
        { isEditingLabel
          ? <input
              type="text"
              value={label}
              onChange={labelChange}
              onKeyDown={labelKeyDown}
              onBlur={labelSave}
            />
          : content.dataSet.attrFromID(attrKey).name
        }
      </div>

      <div className={valueClassNames} onDoubleClick={handleDoubleClick} onClick={handleClick}>
        { isEditingValue
          ? <input
              type="text"
              value={value}
              onChange={valueChange}
              onKeyDown={valueKeyDown}
              onBlur={valueSave}
            />
          : content.dataSet.getValue(caseId, attrKey)
        }
      </div>
    </div>
  );
});
