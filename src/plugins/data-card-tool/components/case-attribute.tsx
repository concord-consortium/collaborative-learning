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

  const imageUrlSync = () => {
    gImageMap.isImageUrl(valueStr) && gImageMap.getImage(valueStr)
    .then((image)=>{
      setImageUrl(image.displayUrl || "");
    });
  };

  imageUrlSync();

  useEffect(() => {
    if (currEditAttrId !== attrKey) {
      setEditFacet("");
    }
  }, [attrKey, currEditAttrId]);

  useEffect(() => {
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
    }
  };

  const handleClick = (event: React.MouseEvent<HTMLInputElement | HTMLDivElement>) => {
    const facet = event.currentTarget.classList[0] as EditFacet;
    const inputHere = event.currentTarget.classList[2] === "editing";

    activateInput(facet as EditFacet, inputHere);

  };

  const activateInput = (facet: EditFacet, inputHere: boolean) => {

    setEditFacet(facet);
    if (facet === "name" && !inputHere){
      setLabelCandidate(getLabel());
    } else {
      console.log('what state is this?')
    }
    if (facet === "value" && !inputHere){
      setValueCandidate(getValue());
    } else {
      console.log('what state is this? 2')
    }
    setCurrEditAttrId(attrKey);
  };

  const handleInputDoubleClick = (event: React.MouseEvent<HTMLInputElement>) => {
    event.currentTarget.select();
  };

  const handleCompleteName = () => {
    console.log("handleCompleteName")
    if (labelCandidate !== getLabel()) {
      caseId && content.setAttName(attrKey, labelCandidate);
    }
    setEditFacet("");
  };

  const handleCompleteValue = () => {
    console.log("handleCompleteValue")
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

  const inputDisplayClassNames = classNames(
    "input",
    { "visible" : !gImageMap.isImageUrl(valueStr) && editFacet === "value" && !readOnly }
  )

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

  const deleteAttrButtonClassNames = classNames(
    `delete-attribute ${attrKey}`,
    { "show": editFacet === "value" || editFacet === "name" }
  );

  const cellLabelClasses = classNames(
    "cell-value",
    { "default-label": looksLikeDefaultLabel(getLabel()) }
  );

  return (
    <div className={pairClassNames}>
      <div style={{ position: "absolute", right: "60px" }}><pre>editFacet: {editFacet}</pre></div>
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
        { !valueIsImage() &&
          <input
            className={inputDisplayClassNames}
            type="text"
            value={valueCandidate}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onBlur={handleCompleteValue}
            onDoubleClick={handleInputDoubleClick}
          />
        }
        { valueIsImage() &&
          <img src={imageUrl} className="image-value" />
        }
      </div>
      <RemoveIconButton className={deleteAttrButtonClassNames} onClick={handleDeleteAttribute} />
    </div>
  );
});
