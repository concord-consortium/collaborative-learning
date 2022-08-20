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
  const [isEditingFacet, setIsEditingFacet] = useState("none");
  const [hasBeenSaved, setHasBeenSaved] = useState(false);
  const [attrsCount, setAttrsCount] = useState(content.existingAttributes().length);
  const [labelN, setLabelN] = useState(`Label ${attrsCount}`)

  useEffect(()=>{
    console.log('main effect on Attribute component');
  });

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const [facet, attr, status] = event.currentTarget.classList;
    const inputVal = event.target.value;
    console.log("handleChange, given: ", facet, attr, status, value )
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

    setIsEditingFacet(facet);
  }

  const handleDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const [facet, attr, status] = event.currentTarget.classList;
    console.log("handleDoubleClick: ",  facet, attr, status);
  }

  const saveClear = () => {
    console.log("save value or label and clear: ", value, label)
    setIsEditingFacet("")
  };

  const activateInput = (facet: string) => {
    console.log("open correct input")
    setIsEditingFacet(facet);
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
  )

  const valueClassNames = classNames(
    `value ${attrKey}`,
    { "editing": isEditingFacet === "value"},
    hasBeenSaved ? "saved" : "unsaved"
  )

  return (
    <div className={pairClassNames}>
      <div className={labelClassNames} onDoubleClick={handleDoubleClick} onClick={handleClick}>
        { !hasBeenSaved &&
          <div className="ghost">{ labelN }</div>
        }
        { isEditingFacet === "name"
          ? <input
              type="text"
              value={label}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onBlur={saveClear}
            />
          : content.dataSet.attrFromID(attrKey).name
        }
      </div>

      <div className={valueClassNames} onDoubleClick={handleDoubleClick} onClick={handleClick}>
        { isEditingFacet === "value"
          ? <input
              type="text"
              value={value}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onBlur={saveClear}
            />
          : content.dataSet.getValue(caseId, attrKey)
        }
      </div>
    </div>
  );
});
