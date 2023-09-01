import React, { useEffect, useState } from "react";
import { observer } from "mobx-react";
import classNames from "classnames";
import { useCombobox } from "downshift";
import { gImageMap } from "../../../models/image-map";
import { ITileModel } from "../../../models/tiles/tile-model";
import { DataCardContentModelType } from "../data-card-content";
import { looksLikeDefaultLabel, EditFacet } from "../data-card-types";
import { RemoveIconButton } from "./add-remove-icons";
import { useCautionAlert } from "../../../components/utilities/use-caution-alert";
import { useErrorAlert } from "../../../components/utilities/use-error-alert";
import { getClipboardContent } from "../../../utilities/clipboard-utils";

import '../data-card-tile.scss';
import { action } from "mobx";

const typeIcons = {
  "date": "📅",
  "categorical": "txt",
  "numeric": "#",
  "image": "📷",
  "boundary": "?",
  "color": "?",
  "checkbox": "?",
  "qualitative": "?",
  "": "?"
};

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

  const attribute = content.dataSet.attrFromID(attrKey);
  const allAttrValues = attribute?.strValues || [];
  const valuesForAutoFill = allAttrValues.filter((value) => {
    return value.substring(0, 8) !== "ccimg://" && isNaN(Number(value));
  });

  // Special handling for enter key in combobox.
  const stateReducer = React.useCallback((state, activity) => {
    if (activity.type === useCombobox.stateChangeTypes.InputKeyDownEnter) {
      console.log('enter key detected, changes = ', activity);
      handleCompleteValue();
      return activity.changes;
    } else {
      return activity.changes;
    }
  }, []);

  const [inputItems, setInputItems] = useState(valuesForAutoFill);
  const {
    isOpen,
    getToggleButtonProps,
    getLabelProps,
    getMenuProps,
    getInputProps,
    highlightedIndex,
    getItemProps,
    setInputValue
  } = useCombobox({
    items: inputItems,
    initialInputValue: valueCandidate,
    stateReducer,
    onInputValueChange: ({inputValue}) => {
      console.log('new input value: ', inputValue);
      const safeValue = inputValue || "";
      setValueCandidate(safeValue);
      const vals = valuesForAutoFill.filter((item) =>
          item.toLowerCase().startsWith(safeValue.toLowerCase()));
      console.log('from ', valuesForAutoFill, ' prefix ', safeValue.toLowerCase(), ' possibilities: ', vals);
      setInputItems(vals);
    }
  });

  // reset contents of input when attribute value changes without direct user input
  // (when it is deleted by toolbar or the underlying case has changed )
  useEffect(()=>{
    setValueCandidate(valueStr);
    setInputValue(valueStr);
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
    gImageMap.addFileImage(imageFile).then(image => {
      if (image.contentUrl) {
        setValueCandidate(image.contentUrl);
        targetElement.blur();
      }
    });
  };

  const handleValuePaste = async (event: React.ClipboardEvent<HTMLInputElement>) => {
    // If the clipboard contains an image element, process the image so it can be saved
    // and rendered. If the clipboard contains a text element, check if it is an image URL.
    // If it is, immediately set the value to the URL. Otherwise, simply let the default
    // paste action occur without any special handling.
    const targetElement = event.currentTarget;
    const clipboardContents = await getClipboardContent(event.clipboardData);
    if (clipboardContents.image) {
      handlePasteImage(clipboardContents.image, targetElement);
    } else if (clipboardContents.text && gImageMap.isImageUrl(clipboardContents.text)) {
      setValue(clipboardContents.text);
    }
  };

  const RequireUniqueAlert = () => {
    return <p>Each field should have a unique name.  Enter a name that is not already in use in this collection.</p>;
  };

  const [showRequireUniqueAlert] = useErrorAlert({
    title: "Error Naming Data Card Field",
    content: RequireUniqueAlert
  });

  const handleCompleteValue = () => {
    if (valueCandidate !== getValue()) {
      caseId && content.setAttValue(caseId, attrKey, valueCandidate);
    }
  };

  const setValue = (value: string) => {
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

  const typeIconClassNames = classNames(
    `type-icon ${attrKey}`
  );

  const deleteAttrButtonClassNames = classNames(
    `delete-attribute ${attrKey}`,
    { "show": currEditAttrId === attrKey }
  );

  const cellLabelClasses = classNames(
    "cell-value",
    { "default-label": looksLikeDefaultLabel(getLabel()) }
  );

  const typeIcon = typeIcons[content.dataSet.attrFromID(attrKey).mostCommonType || ""];



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
          <div style={{display: (!readOnly && !valueIsImage()) ? 'block' : 'none'}}>
            <input
              {...getInputProps()}
              className={valueInputClassNames}
              onFocus={handleValueInputFocus}
              onBlur={handleCompleteValue}
              />
            <button
                aria-label="toggle menu"
                className="px-2"
                type="button"
                {...getToggleButtonProps()}
            >
                {isOpen ? <>&#8593;</> : <>&#8595;</>}
            </button>
            <ul {...getMenuProps()}>
              {isOpen &&
                inputItems.map((item, index) => (
                  <li style={highlightedIndex === index ? {backgroundColor: '#bde4ff'} : {} }
                      key={`${item}${index}`}
                      {...getItemProps({item, index})}
                  >
                    {item}
                  </li>
              ))}
            </ul>
          </div>
        { false &&
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
      <div className={typeIconClassNames} >{typeIcon}</div>

      { !readOnly &&
        <RemoveIconButton className={deleteAttrButtonClassNames} onClick={handleDeleteAttribute} />
      }
    </div>
  );
});
