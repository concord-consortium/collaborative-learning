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

  useEffect(()=>{
    console.log('main effect on Attribute component');
  });

  const labelChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setLabel(event.target.value);
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
  };

  const valueKeyDown = (event:  React.KeyboardEvent<HTMLInputElement>) => {
    const { key } = event;
    if ( key === "Enter"){
      valueSave();
    }
  };

  const valueSave = () => {
    console.log("val save: ", value);
    setHasBeenSaved(true)
  };

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    //detect where click is and handle it - likely toggling various inputs and selections
    console.log("handleClick: ", event.target)
  }

  const handleDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    //detect where click is and handle it - likely toggling various inputs and selections
    console.log("handleDoubleClick: ", event.target)
  }

  const pairClassNames = classNames(
    "attribute-name-value-pair",
    `${attrKey}`,
    { "editing-label": isEditingLabel},
    { "editing-value": isEditingValue},
    hasBeenSaved ? "has-been-saved" : "not-saved"
  );

  return (
    <div className={pairClassNames}>
      <div className={`name ${attrKey}`} onDoubleClick={handleDoubleClick} onClick={handleClick}>
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

      <div className={`value ${attrKey}`} onDoubleClick={handleDoubleClick} onClick={handleClick}>
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
