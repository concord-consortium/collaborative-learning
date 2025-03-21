import React, { useCallback, useEffect, useState } from "react";
import { observer } from "mobx-react";
import { isAlive } from "mobx-state-tree";
import escapeStringRegexp from "escape-string-regexp";
import { useCombobox } from "downshift";
import { uniq } from "lodash";
import { VisuallyHidden } from "@chakra-ui/react";
import classNames from "classnames";
import { gImageMap } from "../../../models/image-map";
import { ITileModel } from "../../../models/tiles/tile-model";
import { DataCardContentModelType } from "../data-card-content";
import { looksLikeDefaultName, EditFacet,
  kFieldWidthFactor, kNameCharsLimit, kValueCharsLimit } from "../data-card-types";
import { RemoveIconButton } from "./add-remove-icons";
import { useIsLinked } from "../use-is-linked";
import { useCautionAlert } from "../../../components/utilities/use-caution-alert";
import { useErrorAlert } from "../../../components/utilities/use-error-alert";
import { getClipboardContent } from "../../../utilities/clipboard-utils";
import { isImageUrl } from "../../../models/data/data-types";
import { useAttributeClassNames } from "../use-case-attribute-class-names";
import { measureTextLines } from "../../../components/tiles/hooks/use-measure-text";
import { TypeAheadItemSpan } from "../type-ahead-item-span";
import DateTypeIcon from "../assets/id-type-date.svg";
import ImageTypeIcon from "../assets/id-type-image.svg";
import TextTypeIcon from "../assets/id-type-text.svg";
import NumberTypeIcon from "../assets/id-type-number.svg";
import ExpandDownIcon from "../assets/expand-more-icon.svg";

import './single-card-data-area.scss';

const typeIcons = {
  "date": <DateTypeIcon />,
  "categorical": <TextTypeIcon />,
  "numeric": <NumberTypeIcon />,
  "image": <ImageTypeIcon />,
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
  if (!isAlive(model)) {
    console.log("rendering unalive model", model);
  }
  const content = model.content as DataCardContentModelType;
  const dataSet = content.dataSet;
  const cell = { attributeId: attrKey, caseId: caseId ?? "" };
  const isLinked = useIsLinked();

  const getName = useCallback(() => {
    return content.dataSet.attrFromID(attrKey)?.name;
  }, [attrKey, content.dataSet]);

  const getValue = useCallback(() => {
    const value = caseId && content.dataSet.getValue(caseId, attrKey) || "";
    return String(value);
  }, [attrKey, caseId, content.dataSet]);

  const valueStr = getValue();
  const [nameCandidate, setNameCandidate] = useState(() => getName());
  const [valueCandidate, setValueCandidate] = useState(() => getValue());
  const [imageUrl, setImageUrl] = useState("");
  const [inputItems, setInputItems] = useState<string[]>([]);
  const [textLinesNeeded, setTextLinesNeeded] = useState(measureTextLines(getName(), 120));
  const editingName = currEditFacet === "name" && currEditAttrId === attrKey;
  const editingValue = currEditFacet === "value" && currEditAttrId === attrKey;

  const validCompletions = useCallback((aValues: string[], userString: string) => {
    const values = uniq(aValues).sort();
    const escapedStr = escapeStringRegexp(userString);
    const regex = new RegExp(escapedStr, 'i');

    return editingValue && valueCandidate.length > 0
      ? values.filter((value) => value && !isImageUrl(value) && regex.test(value))
      : values.filter((value) => value && !isImageUrl(value));

  }, [editingValue, valueCandidate.length]);

  useEffect(() => {
    const name = getName();
    if (!name) return;
    const nameLines = measureTextLines(name, kFieldWidthFactor);
    const nameCandidateLines = measureTextLines(nameCandidate, kFieldWidthFactor);
    const nameLinesNeeded = Math.max(nameLines, nameCandidateLines);
    const valueLines = measureTextLines(valueStr, kFieldWidthFactor);
    const valueCandidateLines = measureTextLines(valueCandidate, kFieldWidthFactor);
    const valueLinesNeeded = !isImageUrl(valueStr) ? Math.max(valueLines, valueCandidateLines) : 4;
    setTextLinesNeeded(Math.max(nameLinesNeeded, valueLinesNeeded));
  }, [getName, getValue, imageUrl, valueCandidate, nameCandidate, valueStr]);

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
    onInputValueChange: ({inputValue}) => {
      const safeValue = inputValue || "";
      setValueCandidate(safeValue);
      const allAttrValues = content.dataSet.attrFromID(attrKey)?.values as string[] || [];
      const completions = validCompletions(allAttrValues, safeValue);
      setInputItems(completions);
    }
  });

  // Add some custom behavior to the properties returned by useCombobox
  function customizedGetInputProps() {
    const propsCreated = getInputProps();

    const defaultBlur = propsCreated.onBlur;
    const newBlur = function(e: React.FocusEvent<Element, Element>) {
      handleCompleteValue();
      if (defaultBlur) defaultBlur(e);
    };
    propsCreated.onBlur = newBlur;

    return propsCreated;
  }

  useEffect(()=>{
    const attrValues = content.dataSet.attrFromID(attrKey)?.strValues || [];
    const completions = validCompletions(attrValues, valueCandidate);
    setInputItems(completions);
  }, [content.dataSet, attrKey, valueCandidate, validCompletions]);

  // reset contents of input when attribute value changes without direct user input
  // (when it is deleted by toolbar or the underlying case has changed )
  useEffect(()=>{
    setValueCandidate(valueStr);
    setInputValue(valueStr);
  }, [setInputValue, valueStr]);

  gImageMap.isImageUrl(valueStr) && gImageMap.getImage(valueStr)
    .then((image)=>{
      setImageUrl(image.displayUrl || "");
    });

  const handleNameChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    editingName && setNameCandidate(event.target.value);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
          setNameCandidate(getName());
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

  const handleNameClick = (event: React.MouseEvent<HTMLInputElement | HTMLDivElement>) => {
    event.stopPropagation();
    dataSet.setSelectedAttributes([attrKey]);
    if (readOnly) return;
    setCurrEditAttrId(attrKey);
    setCurrEditFacet("name");
    !editingName && setNameCandidate(getName());
  };

  const handleValueClick = (event: React.MouseEvent<HTMLInputElement | HTMLDivElement>) => {
    event.stopPropagation();
    dataSet.setSelectedCells([cell]);
    if (readOnly) return;
    setCurrEditAttrId(attrKey);
    setCurrEditFacet("value");
    !editingValue && setValueCandidate(getValue());
  };

  const handleInputDoubleClick = (event: React.MouseEvent<HTMLTextAreaElement>) => {
    event.currentTarget.select();
  };

  const handleCompleteName = () => {
    if (nameCandidate !== getName()) {
      const names = content.existingAttributesWithNames().map(a => a.attrName);
      if (!names.includes(nameCandidate)){
        caseId && content.setAttName(attrKey, nameCandidate);
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

  const handleValuePaste = async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
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

  function deleteAttribute() {
    if (attrKey){
      content.dataSet.removeAttribute(attrKey);
    }
  }

  const DeleteAttributeAlertContent = () => {
    return (
      <p>
        Are you sure you want to remove the <em style={{ fontWeight: "bold"}}>{ getName() }</em>&nbsp;
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

  const displayArrow = () => {
    if (inputItems.length > 0) {
      return <ExpandDownIcon className={ isOpen ? "down" : "up"}/>;
    }
    return <span></span>; // There may be more cases in the future, e.g. date picker
  };

  const attributeSelected = dataSet.isAttributeSelected(attrKey);
  const valueHighlighted = attributeSelected || content.caseSelected || dataSet.isCellSelected(cell);
  const typeIcon = typeIcons[content.dataSet.attrFromID(attrKey).mostCommonType || ""];

  const {
    pairClasses,
    nameAreaClasses,
    nameInputClasses,
    nameTextClasses,
    valueAreaClasses,
    buttonsAreaClasses,
    valueInputClasses,
    dropdownClasses,
    typeIconClasses,
    deleteAttrClasses
  } = useAttributeClassNames({
    attrKey,
    textLinesNeeded,
    editingName,
    attributeSelected,
    isLinked,
    looksLikeDefaultName,
    getName,
    editingValue,
    valueStr,
    gImageMap,
    valueHighlighted,
    isOpen,
    validCompletions,
    currEditAttrId
  });

  return (
    <div className={pairClasses}>

      <div className={nameAreaClasses} onClick={handleNameClick}>
        { !readOnly && editingName
          ? <textarea
              className={nameInputClasses}
              value={nameCandidate}
              onChange={handleNameChange}
              onKeyDown={handleKeyDown}
              onBlur={handleCompleteName}
              onDoubleClick={handleInputDoubleClick}
              maxLength={kNameCharsLimit}
            />
          : <div className={nameTextClasses}>{getName()}</div>
        }
      </div>

      <div className={valueAreaClasses} onClick={handleValueClick}>
        <VisuallyHidden>
          <label {...getLabelProps()} className="">
            Value for {nameCandidate}
          </label>
        </VisuallyHidden>
        <textarea
          style={{display: (!readOnly && !valueIsImage()) ? 'block' : 'none'}}
          {...customizedGetInputProps()}
          className={valueInputClasses}
          onFocus={handleValueInputFocus}
          onPaste={handleValuePaste}
          maxLength={kValueCharsLimit}
        />
        { valueIsImage() && <img src={imageUrl} className="value-image" /> }
        { readOnly && !valueIsImage() && <div className="value-text">{valueStr}</div> }

        <ul {...getMenuProps()} className={dropdownClasses}>
          { isOpen && inputItems.map((item, index) => {
            const isHighlighted = highlightedIndex === index;
            const itemProps = getItemProps({ item, index });
            return (
              <li
                className={classNames("dropdown-item", { "selecting-item" : isHighlighted })}
                key={`${item}${index}`}
                {...itemProps}
              >
                <TypeAheadItemSpan fullString={item} matchString={valueCandidate} />
              </li>
            );
          })}
        </ul>
      </div>

      <div className={buttonsAreaClasses}>
        <button aria-label="toggle menu" type="button" {...getToggleButtonProps()}>
          {displayArrow()}
        </button>

        <div className={typeIconClasses} >{typeIcon}</div>

        { !readOnly &&
          <RemoveIconButton className={deleteAttrClasses} onClick={handleDeleteAttribute} />
        }
      </div>
    </div>
  );
});
