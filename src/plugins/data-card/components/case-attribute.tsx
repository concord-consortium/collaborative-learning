import { observer } from "mobx-react";
import classNames from "classnames";
import React, { useEffect, useState } from "react";
import { gImageMap } from "../../../models/image-map";
import { ITileModel } from "../../../models/tiles/tile-model";
import { DataCardContentModelType } from "../data-card-content";
import { looksLikeDefaultLabel, EditFacet } from "../data-card-types";
import { RemoveIconButton } from "./add-remove-icons";
import { useCautionAlert } from "../../../components/utilities/use-caution-alert";
import { useErrorAlert } from "../../../components/utilities/use-error-alert";
// import { getClipboardContent } from "../../../utilities/clipboard-utils";

import '../data-card-tile.scss';

interface IProps {
  model: ITileModel;
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
        event.currentTarget.blur();
        setCurrEditAttrId("");
        setCurrEditFacet("");
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
      const names = content.existingAttributesWithNames().map(a => a.attrName);
      if (!names.includes(labelCandidate)){
        caseId && content.setAttName(attrKey, labelCandidate);
      } else {
        showRequireUniqueAlert();
      }
    }
  };

  const handlePasteImage = (imageFile: File, targetElement: HTMLElement) => {
    // const randomString = Date.now().toString(32) + Math.random().toString(16).substring(2, 15);
    // const newFileName = `clipboard-image-${randomString}.png`;
    // const newFileData = new File([imageFile], newFileName);
    gImageMap.addFileImage(imageFile).then(image => {
      if (image.contentUrl) {
        setValueCandidate(image.contentUrl);
        targetElement.blur();
      }
    });
  };

  const handleValuePaste = async (event: React.ClipboardEvent<HTMLInputElement>) => {
    // If the clipboard contains an image element, prevent the default paste action
    // and process the image so it can be saved and rendered. Otherwise, allow the
    // default paste action to occur.
    const pastedItem = event.clipboardData.items[1]?.type.includes("image")
                         ? event.clipboardData.items[1]
                         : event.clipboardData.items[0];
    if (pastedItem.type.includes("image")) {
      event.preventDefault();
      const imageFile = pastedItem.getAsFile();
      if (imageFile) {
        handlePasteImage(imageFile, event.currentTarget);
      }
    } else if (pastedItem.type.includes("text/plain")) {
      const text = event.clipboardData.getData("text/plain");
      if (text && gImageMap.isImageUrl(text)) {
        event.preventDefault();
        setValueCandidate(text);
        handleCompleteValue();
        handleCompleteName();
        event.currentTarget.blur();
        setCurrEditAttrId("");
        setCurrEditFacet("");
      }
    }

    // TODO: Use existing pasteClipboardImage?
    // const clipboardContents = await getClipboardContent(clipboardData);
    // if (clipboardContents.image) {
    //   event.preventDefault();
    //   handlePasteImage(clipboardContents.image, targetElement);
    // }
  };

  const RequireUniqueAlert = () => {
    return <p>Each field should have a unique name.  Enter a name that is not already in use in this collection.</p>;
  };

  const [showRequireUniqueAlert] = useErrorAlert({
    title: "Error Naming Data Card Field",
    content: RequireUniqueAlert
  });

  const handleCompleteValue = () => {
    console.log("handleCompleteValue", valueCandidate, getValue());
    if (valueCandidate !== getValue()) {
      caseId && content.setAttValue(caseId, attrKey, valueCandidate);
    }
  };

  const handleCompleteValue2 = (value: string) => {
    console.log("handleCompleteValue2", value, getValue(), caseId);
    if (value !== getValue()) {
      caseId && content.setAttValue(caseId, attrKey, value);
    }
  };

  function deleteAttribute(){
    if(attrKey){
      content.dataSet.removeAttribute(attrKey);
    }
  }

  const DeleteAttributeAlertContent = () => {
    return (
      <p>
        Are you sure you want to remove the <em style={{ fontWeight: "bold"}}>{ getLabel() }</em>&nbsp;
        attribute from the Data Card? If you remove it from this card it will delete the data in the field,
        and it will also be removed from all the Cards in this collection.
      </p>
    );
  };

  const [showDeleteAttributeAlert] = useCautionAlert({
    title: "Delete Attribute",
    content: DeleteAttributeAlertContent,
    confirmLabel: "Delete Attribute",
    onConfirm: () => deleteAttribute()
  });

  const handleDeleteAttribute = () => {
    showDeleteAttributeAlert();
  };

  const valueIsImage = () => {
    return gImageMap.isImageUrl(valueStr);
  };

  //allow user to edit value when arriving by tab
  const handleValueInputFocus = (event: React.FocusEvent) => {
    if (event.target.classList.contains("value-input")){
      setCurrEditAttrId(attrKey);
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
            onPaste={handleValuePaste}
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
