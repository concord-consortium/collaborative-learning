import { observer } from "mobx-react";
import classNames from "classnames";
import React, { useEffect, useState } from "react";
import { gImageMap } from "../../../models/image-map";
import { ToolTileModelType } from "../../../models/tools/tool-tile";
import { DataCardContentModelType } from "../data-card-content";
import { looksLikeDefaultLabel, EditFacet } from "../data-card-types";
import { RemoveIconButton } from "./add-remove-icons";
import { useCautionAlert } from "../../../components/utilities/use-caution-alert";

import '../data-card-tool.scss';

interface IProps {
  model: ToolTileModelType;
  caseId?: string;
  attrKey: string;
  currEditAttrId: string;
  currEditFacet: EditFacet;
  readOnly?: boolean;
  imageUrlToAdd?: string;
  setImageUrlToAdd: (url: string) => void;
  setCurrEditAttrId: (attrId: string) => void;
  setCurrEditFacet: (facetName: EditFacet) => void;
}

export const CaseAttribute: React.FC<IProps> = observer(props => {
  const {
    model, caseId, attrKey, currEditAttrId, currEditFacet,
    setCurrEditFacet, setCurrEditAttrId, readOnly
  } = props;
  const content = model.content as DataCardContentModelType;
  const getLabel = () => content.dataSet.attrFromID(attrKey).name;
  const getValue = () => {
    const value = caseId && content.dataSet.getValue(caseId, attrKey) || "";
    return String(value);
  };
  const valueStr = getValue();
  const [labelCandidate, setLabelCandidate] = useState(() => getLabel());
  const [valueCandidate, setValueCandidate] = useState(() => getValue());
  const [imageUrl, setImageUrl] = useState("");

  const editingLabel = currEditFacet === "name" && currEditAttrId === attrKey;
  const editingValue = currEditFacet === "value" && currEditAttrId === attrKey;

  // reset contents of input when attribute value changes without direct user input
  // (when it is deleted by toolbar or the underlying case has changed )
  useEffect(()=>{
    setValueCandidate(valueStr);
  },[valueStr]);

  gImageMap.isImageUrl(valueStr) && gImageMap.getImage(valueStr)
    .then((image)=>{
      setImageUrl(image.displayUrl || "");
    });

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    editingLabel && setLabelCandidate(event.target.value);
    editingValue && setValueCandidate(event.target.value);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const { key } = event;
    switch (key) {
      case "Enter":
        handleCompleteValue();
        handleCompleteName();
        break;
      case "Escape":
        if (currEditFacet === "name") {
          setLabelCandidate(getLabel());
        }
        else if (currEditFacet === "value") {
          setValueCandidate(getValue());
        }
        break;
      case "Tab":
        handleCompleteValue();
        handleCompleteName();
        break;
    }
  };

  const handleLabelClick = (event: React.MouseEvent<HTMLInputElement | HTMLDivElement>) => {
    event.stopPropagation();
    if (readOnly) return;
    setCurrEditAttrId(attrKey);
    setCurrEditFacet("name");
    !editingLabel && setLabelCandidate(getLabel());
  };

  const handleValueClick = (event: React.MouseEvent<HTMLInputElement | HTMLDivElement>) => {
    event.stopPropagation();
    if (readOnly) return;
    setCurrEditAttrId(attrKey);
    setCurrEditFacet("value");
    !editingValue && setValueCandidate(getValue());
  };

  const handleInputDoubleClick = (event: React.MouseEvent<HTMLInputElement>) => {
    event.currentTarget.select();
  };

  const handleCompleteName = () => {
    if (labelCandidate !== getLabel()) {
      caseId && content.setAttName(attrKey, labelCandidate);
    }
  };

  const handleCompleteValue = () => {
    if (valueCandidate !== getValue()) {
      caseId && content.setAttValue(caseId, attrKey, valueCandidate);
    }
  };

  function deleteAttribute(){
    if(attrKey){
      content.dataSet.removeAttribute(attrKey);
    }
  }

  const AlertContent = () => {
    return (
      <p>
        Are you sure you want to remove the <em style={{ fontWeight: "bold"}}>{ getLabel() }</em>&nbsp;
        attribute from the Data Card? If you remove it from this card it will delete the data in the field,
        and it will also be removed from all the Cards in this collection.
      </p>
    );
  };

  const [showAlert] = useCautionAlert({
    title: "Delete Attribute",
    content: AlertContent,
    confirmLabel: "Delete Attribute",
    onConfirm: () => deleteAttribute()
  });

  const handleDeleteAttribute = () => {
    showAlert();
  };

  const valueIsImage = () => {
    return gImageMap.isImageUrl(valueStr);
  };

  //allow user to edit value when arriving by tab
  const handleValueInputFocus = (event: React.FocusEvent) => {
    if (event.target.classList.contains("value-input")){
      setCurrEditAttrId(event.target.classList[1]);
      setCurrEditFacet("value");
    }
  };

  const pairClassNames = `attribute-name-value-pair ${attrKey}`;
  const valueInputClassNames = `value-input ${attrKey}`;

  const labelClassNames = classNames(
    `name ${attrKey}`,
    { "editing": editingLabel }
  );

  const valueClassNames = classNames(
    `value ${attrKey}`,
    { "editing": editingValue },
    {"has-image": gImageMap.isImageUrl(valueStr)}
  );

  const deleteAttrButtonClassNames = classNames(
    `delete-attribute ${attrKey}`,
    { "show": currEditAttrId === attrKey }
  );

  const cellLabelClasses = classNames(
    "cell-value",
    { "default-label": looksLikeDefaultLabel(getLabel()) }
  );

  return (
    <div className={pairClassNames}>
      <div className={labelClassNames} onClick={handleLabelClick}>
        { !readOnly && editingLabel
          ? <input
              type="text"
              className="input"
              value={labelCandidate}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onBlur={handleCompleteName}
              onDoubleClick={handleInputDoubleClick}
            />
          : <div className={cellLabelClasses}>{getLabel()}</div>
        }
      </div>

      <div className={valueClassNames} onClick={handleValueClick}>
        { !readOnly && !valueIsImage() &&
          <input
            className={valueInputClassNames}
            type="text"
            value={valueCandidate}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onBlur={handleCompleteValue}
            onDoubleClick={handleInputDoubleClick}
            onFocus={handleValueInputFocus}
          />
        }
        { !readOnly && valueIsImage() &&
          <img src={imageUrl} className="image-value" />
        }

        { readOnly && !valueIsImage() &&
          <div className="cell-value">{valueStr}</div>
        }
        { readOnly && valueIsImage() &&
          <img src={imageUrl} className="image-value" />
        }
      </div>

      { !readOnly &&
        <RemoveIconButton className={deleteAttrButtonClassNames} onClick={handleDeleteAttribute} />
      }
    </div>
  );
});
