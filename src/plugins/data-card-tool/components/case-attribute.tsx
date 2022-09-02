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

  console.log("rendering: ", attrKey)

  useEffect(() => {
    if (currEditAttrId !== attrKey) {
      setEditFacet("");
    }
  }, [attrKey, currEditAttrId]);

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
    }
  };

  const handleDeleteImageData = (event: React.MouseEvent<HTMLDivElement>) => {
    setCurrEditAttrId(attrKey);
    caseId && content.setAttValue(caseId, attrKey, "");
  };

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    setCurrEditAttrId(attrKey);
    console.log("1 handleClick: attrKey:", attrKey);
  };

  const handleDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const [facet] = event.currentTarget.classList;
    activateInput(facet as EditFacet);
  };

  const handleNameBlur = () => {
    if (labelCandidate !== getLabel()) {
      content.setAttName(attrKey, labelCandidate);
    }
    setEditFacet("");
  };

  const handleCompleteValue = () => {
    if (valueCandidate !== getValue()) {
      caseId && content.setAttValue(caseId, attrKey, valueCandidate);
    }
    setEditFacet("");
  };

  const activateInput = (facet: EditFacet) => {
    console.log("2 start activateInput:", attrKey);
    setEditFacet(facet);
    if (facet === "name"){
      setLabelCandidate(getLabel());
    }
    if (facet === "value"){
      setValueCandidate(getValue());
    }
    setCurrEditAttrId(attrKey);
    console.log("3 finish activateInput:", attrKey);
  };

  function deleteAttribute(){
    console.log("? deleteAttribute: ", attrKey)
    if(attrKey){
      content.dataSet.removeAttribute(attrKey);
    }
  }

  const AlertContent = () => {
    return (
      <p>
        Are you sure you want to remove this attribute from the Data Card?
        If you remove it from this card it will also be removed from all the Cards in this collection.
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

  const pairClassNames = classNames(
    `attribute-name-value-pair ${attrKey}`,
    {"editing": editFacet === "name" || "value"}
  );

  const labelClassNames = classNames(
    `name ${attrKey}`,
    { "editing": editFacet === "name"}
  );

  const valueClassNames = classNames(
    `value ${attrKey}`,
    { "editing": editFacet === "value" }
  );

  const deleteAttrButtonClassNames = classNames(
    `delete-attribute ${attrKey}`,
    { "show": editFacet === "value" || editFacet === "name" }
  );

  const isDefaultLabel = looksLikeDefaultLabel(getLabel());
  const cellLabelClasses = classNames("cell-value", { "default-label": isDefaultLabel });

  gImageMap.isImageUrl(valueStr) && gImageMap.getImage(valueStr)
     .then((image)=>{
       setImageUrl(image.displayUrl || "");
     });

  return (
    <div className={pairClassNames}>
      <div className={labelClassNames} onClick={handleClick} onDoubleClick={handleDoubleClick}>
        { !readOnly && editFacet === "name"
          ? <input
              type="text"
              value={labelCandidate}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onBlur={handleNameBlur}
            />
          : <div className={cellLabelClasses}>{getLabel()}</div>
        }
      </div>

      <div className={valueClassNames} onClick={handleClick} onDoubleClick={handleDoubleClick}>
        { editFacet === "value" && !readOnly
          ? <input
              type="text"
              value={valueCandidate}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onBlur={handleCompleteValue}
            />
          : gImageMap.isImageUrl(valueStr)
            ?   <div className="image-wrapper">
                  <img src={imageUrl} className="image-value" />
                  <div className="delete-image-button" onClick={handleDeleteImageData}>X</div>
                </div>
            : <div className="cell-value">{valueStr}</div>
        }
      </div>
      <RemoveIconButton className={deleteAttrButtonClassNames} onClick={handleDeleteAttribute} />
    </div>
  );
});
