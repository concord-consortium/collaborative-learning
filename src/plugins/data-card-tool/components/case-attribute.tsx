import { observer } from "mobx-react";
import classNames from "classnames";
import React, { useEffect, useState } from "react";
import { gImageMap } from "../../../models/image-map";
import { ToolTileModelType } from "../../../models/tools/tool-tile";
import { DataCardContentModelType } from "../data-card-content";
import { looksLikeDefaultLabel } from "../data-card-types";
import { RemoveIconButton } from "./add-remove-icons";
import { useCautionAlert } from "../../../components/utilities/use-caution-alert";

import '../data-card-tool.scss';

type EditFacet = "name" | "value" | ""

interface IProps {
  model: ToolTileModelType;
  caseId?: string;
  attrKey: string;
  currEditAttrId: string;
  readOnly?: boolean;
  imageUrlToAdd?: string;
  setImageUrlToAdd: (url: string) => void;
  setCurrEditAttrId: (attrId: string) => void;
}

export const CaseAttribute: React.FC<IProps> = observer(props => {
  const { model, caseId, attrKey, currEditAttrId, setCurrEditAttrId, readOnly} = props;
  const content = model.content as DataCardContentModelType;
  const getLabel = () => content.dataSet.attrFromID(attrKey).name;
  const getValue = () => {
    const value = caseId && content.dataSet.getValue(caseId, attrKey) || "";
    return String(value);
  };
  const valueStr = getValue();
  const [labelCandidate, setLabelCandidate] = useState(() => getLabel());
  const [valueCandidate, setValueCandidate] = useState(() => getValue());
  const [editFacet, setEditFacet] = useState<EditFacet>("");
  const [imageUrl, setImageUrl] = useState("");

  gImageMap.isImageUrl(valueStr) && gImageMap.getImage(valueStr)
    .then((image)=>{
      setImageUrl(image.displayUrl || "");
    });

  useEffect(()=>{
    setValueCandidate(valueStr);
  },[caseId]);

  useEffect(() => {
    //getValue();
    if (currEditAttrId !== attrKey) {
      setEditFacet("");
    }
  }, [attrKey, currEditAttrId]);

  useEffect(() => {
    const advancedToNewCard = getValue() === "" && valueCandidate !== "";
    advancedToNewCard && setValueCandidate("");
    setEditFacet("");
  }, [valueStr]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (editFacet === "name"){
      const inputVal = event.target.value;
      setLabelCandidate(inputVal);
    }
    if (editFacet === "value"){
      const inputVal = event.target.value;
      setValueCandidate(inputVal);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const { key } = event;
    switch (key) {
      case "Enter":
        handleCompleteValue();
        handleCompleteName();
        setEditFacet("");
        break;
      case "Escape":
        if (editFacet === "name") {
          setLabelCandidate(getLabel());
        }
        else if (editFacet === "value") {
          setValueCandidate(getValue());
        }
        setEditFacet("");
        break;
      case "Tab":
        handleCompleteValue();
        handleCompleteName();
        setEditFacet("");
        break;
    }
  };

  const handleClick = (event: React.MouseEvent<HTMLInputElement | HTMLDivElement>) => {
    if (readOnly){
      return;
    }
    setCurrEditAttrId(attrKey);
    const facet = event.currentTarget.classList[0] as EditFacet;
    const isEditing = event.currentTarget.classList[2] === "editing";
    activateInput(facet as EditFacet, isEditing);
  };

  const activateInput = (facet: EditFacet, isEditing: boolean) => {
    setEditFacet(facet);
    if (facet === "name" && !isEditing){
      setLabelCandidate(getLabel());
    }
    if (facet === "value" && !isEditing){
      setValueCandidate(getValue());
    }
  };

  const handleInputDoubleClick = (event: React.MouseEvent<HTMLInputElement>) => {
    event.currentTarget.select();
  };

  const handleCompleteName = () => {
    if (labelCandidate !== getLabel()) {
      caseId && content.setAttName(attrKey, labelCandidate);
    }
    setEditFacet("");
  };

  const handleCompleteValue = () => {
    if (valueCandidate !== getValue()) {
      caseId && content.setAttValue(caseId, attrKey, valueCandidate);
    }
    setEditFacet("");
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

  // this allows user to edit next field when arriving by tab
  const handleValueInputFocus = () => {
    activateInput("value", true);
  };

  const pairClassNames = classNames(
    `attribute-name-value-pair ${attrKey}`,
    {"editing": editFacet === "name" || editFacet === "value"},
    {"has-image": gImageMap.isImageUrl(valueStr)}
  );

  const labelClassNames = classNames(
    `name ${attrKey}`,
    { "editing": editFacet === "name"}
  );

  const valueClassNames = classNames(
    `value ${attrKey}`,
    { "editing": editFacet === "value" },
    {"has-image": gImageMap.isImageUrl(valueStr)}
  );

  const valueInputClassNames = classNames(
    `value-input ${attrKey}`,
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
      <div className={labelClassNames} onClick={handleClick}>
        { !readOnly && editFacet === "name"
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

      <div className={valueClassNames} onClick={handleClick}>
        {/* author view: text is in input, image is in a div */}
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

        {/* read-only view: text is in div, image is in a div */}
        { !valueIsImage() && readOnly &&
          <div className="cell-value">{valueStr}</div>
        }
        { valueIsImage() && readOnly &&
          <img src={imageUrl} className="image-value" />
        }
      </div>
      { !readOnly &&
        <RemoveIconButton className={deleteAttrButtonClassNames} onClick={handleDeleteAttribute} />
      }
    </div>
  );
});
