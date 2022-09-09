import classNames from "classnames";
import { observer } from "mobx-react";
import React, { useEffect, useState } from "react";
import { IToolTileProps } from "../../components/tools/tool-tile";
import { useUIStore } from "../../hooks/use-stores";
import { DataCardContentModelType } from "./data-card-content";
import { DataCardRows } from "./components/data-card-rows";
import { DataCardToolbar } from "./data-card-toolbar";
import { useToolbarToolApi } from "../../components/tools/hooks/use-toolbar-tool-api";
import { AddIconButton, RemoveIconButton } from "./components/add-remove-icons";
import { useCautionAlert } from "../../components/utilities/use-caution-alert";

import "./data-card-tool.scss";

export const DataCardToolComponent: React.FC<IToolTileProps> = observer((props) => {
  const { model, onRequestUniqueTitle, readOnly, documentContent, toolTile, onRegisterToolApi,
            onUnregisterToolApi } = props;
  const content = model.content as DataCardContentModelType;
  const ui = useUIStore();
  const isTileSelected = ui.selectedTileIds.findIndex(id => id === content.metadata.id) >= 0;
  const [titleValue, setTitleValue] = useState(content.title);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [currEditAttrId, setCurrEditAttrId] = useState<string>("");
  const [imageUrlToAdd, setImageUrlToAdd] = useState("");
  const shouldShowAddCase = !readOnly && isTileSelected;
  const shouldShowDeleteCase = !readOnly && isTileSelected && content.dataSet.cases.length > 1;
  const shouldShowAddField = !readOnly && isTileSelected;

  useEffect(() => {
    if (!content.title) {
      const title = onRequestUniqueTitle(model.id);
      title && content.setTitle(title);
    }
  }, [content, model.id, onRequestUniqueTitle]);

  function nextCase(){
    if (content.caseIndex < content.totalCases - 1) {
      content.setCaseIndex(content.caseIndex + 1);
    }
  }

  function previousCase(){
    if (content.caseIndex > 0){
      content.setCaseIndex(content.caseIndex - 1);
    }
  }

  const handleTitleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setTitleValue(event.target.value);
  };

  const handleTitleClick = () => {
    if (!readOnly){
      setIsEditingTitle(true);
    }
  };

  const handleTitleInputClick = (event: React.MouseEvent<HTMLInputElement>) => {
    event.currentTarget.focus();
    const isHighlighted = event.currentTarget.selectionStart === 0;
    const valLength = event.currentTarget.value.length;
    if (isHighlighted && valLength > 0){
        event.currentTarget.setSelectionRange(valLength, valLength, "forward");
    }
  };

  const handleTitleInputDoubleClick = (event: React.MouseEvent<HTMLInputElement>) => {
    event.currentTarget.select();
  };

  const handleTitleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case "Enter":
        handleCompleteTitle();
        setIsEditingTitle(false);
        break;
      case "Escape":
        setTitleValue(content.title);
        setIsEditingTitle(false);
        break;
    }
  };

  const handleCompleteTitle = () => {
    if (titleValue){
      content.setTitle(titleValue);
    }
    setIsEditingTitle(false);
  };

  function addNewCase(){
    content.addNewCaseFromAttrKeys(content.existingAttributes());
    content.setCaseIndex(content.totalCases - 1);
  }

  function deleteCase(){
    const thisCaseId = content.dataSet.caseIDFromIndex(content.caseIndex);
    if (thisCaseId) {
      content.dataSet.removeCases([thisCaseId]);
    }
    previousCase();
  }

  const AlertContent = () => {
    return <p>Delete the current Data Card?</p>;
  };

  const [showAlert] = useCautionAlert({
    title: "Delete Card",
    content: AlertContent,
    confirmLabel: "Delete Card",
    onConfirm: () => deleteCase()
  });

  function handleDeleteCardClick(){
    const thisCaseId = content.dataSet.caseIDFromIndex(content.caseIndex);
    if (thisCaseId){
      if (content.isEmptyCase(thisCaseId)){
        deleteCase();
      } else {
        showAlert();
      }
    }
  }

  const handleAddField = () => {
    content.addNewAttr();
  };

  const deleteSelectedAttr = () => {
    const thisCaseId = content.dataSet.caseIDFromIndex(content.caseIndex);
    if (thisCaseId){
      content.setAttValue(thisCaseId, currEditAttrId, "");
    }
  }

  const previousButtonClasses = classNames(
    "card-nav", "previous",
    content.caseIndex > 0 ? "active" : "disabled",
  );

  const nextButtonClasses = classNames(
    "card-nav", "next",
    content.caseIndex < content.totalCases - 1 ? "active" : "disabled",
  );

  const addCardClasses = classNames("add-card", "teal-bg", { hidden: !shouldShowAddCase });
  const removeCardClasses = classNames("remove-card", { hidden: !shouldShowDeleteCase });
  const toolbarProps = useToolbarToolApi({ id: model.id, enabled: !readOnly, onRegisterToolApi, onUnregisterToolApi });

  return (
    <div className="data-card-tool">
      <DataCardToolbar
        model={model}
        documentContent={documentContent}
        toolTile={toolTile}
        currEditAttrId={currEditAttrId}
        setImageUrlToAdd={setImageUrlToAdd} {...toolbarProps}
        handleDeleteValue={deleteSelectedAttr}
      />
      <div className="data-card-header-row">
        <div className="panel title">
          { isEditingTitle && !readOnly
          ? <input
              className="data-card-title-input-editing"
              value={titleValue}
              onChange={handleTitleChange}
              onKeyDown={handleTitleKeyDown}
              onBlur={handleCompleteTitle}
              onClick={handleTitleInputClick}
              onDoubleClick={handleTitleInputDoubleClick}
          />
          : <div className="editable-data-card-title-text" onClick={handleTitleClick}>
              { content.title }
            </div>
          }
        </div>
        <div className="panel nav">
          <div className="card-number-of-listing">
            <div className="cell-text">
              { content.totalCases > 0
                  ? `Card ${content.caseIndex + 1} of ${content.totalCases}`
                  : "Add a card" }
            </div>
          </div>
          <div className="card-nav-buttons">
            <button className={ previousButtonClasses } onClick={previousCase}></button>
            <button className={ nextButtonClasses } onClick={nextCase}></button>
          </div>
          <div className="add-remove-card-buttons">
            <AddIconButton className={addCardClasses} onClick={addNewCase} />
            <RemoveIconButton className={removeCardClasses} onClick={handleDeleteCardClick} />
          </div>
        </div>
      </div>
      <div className="data-area">
        { content.totalCases > 0 &&
          <DataCardRows
            caseIndex={content.caseIndex}
            model={model}
            totalCases={content.totalCases}
            readOnly={readOnly}
            currEditAttrId={currEditAttrId}
            setCurrEditAttrId={setCurrEditAttrId}
            imageUrlToAdd={imageUrlToAdd}
            setImageUrlToAdd={setImageUrlToAdd}
          />
        }
      </div>
      { shouldShowAddField &&
        <AddIconButton className="add-field" onClick={handleAddField} /> }
    </div>
  );
});
DataCardToolComponent.displayName = "DataCardToolComponent";
