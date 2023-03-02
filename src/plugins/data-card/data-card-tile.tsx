import classNames from "classnames";
import { observer } from "mobx-react";
import React, { useEffect, useState } from "react";
import { ITileProps } from "../../components/tiles/tile-component";
import { useUIStore } from "../../hooks/use-stores";
import { DataCardContentModelType } from "./data-card-content";
import { DataCardRows } from "./components/data-card-rows";
import { DataCardToolbar } from "./data-card-toolbar";
import { useToolbarTileApi } from "../../components/tiles/hooks/use-toolbar-tile-api";
import { AddIconButton, RemoveIconButton } from "./components/data-card-icons";
import { useCautionAlert } from "../../components/utilities/use-caution-alert";
import { EditFacet } from "./data-card-types";

import "./data-card-tile.scss";

export const DataCardToolComponent: React.FC<ITileProps> = observer((props) => {
  const { model, onRequestUniqueTitle, readOnly, documentContent, tileElt, onRegisterTileApi,
            onUnregisterTileApi } = props;
  const content = model.content as DataCardContentModelType;
  const ui = useUIStore();
  const isTileSelected = ui.selectedTileIds.findIndex(id => id === content.metadata.id) >= 0;
  const [titleValue, setTitleValue] = useState(content.title);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [currEditAttrId, setCurrEditAttrId] = useState<string>("");
  const [currEditFacet, setCurrEditFacet] = useState<EditFacet>("");
  const [imageUrlToAdd, setImageUrlToAdd] = useState<string>("");
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

  const deleteSelectedValue = () => {
    const thisCaseId = content.dataSet.caseIDFromIndex(content.caseIndex);
    if (thisCaseId){
      content.setAttValue(thisCaseId, currEditAttrId, "");
    }
  };

  const duplicateCard = () => {
    const originalCaseIndex = content.caseIndex;
    const copyableCase = content.caseByIndex(originalCaseIndex);
    addNewCase(); // increments caseIndex
    const newCaseId = content.dataSet.caseIDFromIndex(content.caseIndex);

    if (newCaseId && content.isEmptyCase(newCaseId)){
      for (const attrId in copyableCase){
        const foundValue = copyableCase[attrId] || "";
        const copyableValue: string = foundValue as string;
        content.setAttValue(newCaseId, attrId, copyableValue);

        //TODO - implement below function to get the case "next to" the one it's copied off of
        const foundIndexWithinDataSet = 0;
        content.moveCaseToDataSetIndex(newCaseId, foundIndexWithinDataSet);
      }
    }
  };

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

  const toolbarProps = useToolbarTileApi(
    {
      id: model.id,
      enabled: !readOnly, // "enabled" is "visible"
      onRegisterTileApi,
      onUnregisterTileApi
    }
  );

  const handleBackgroundClick = (event: React.MouseEvent<HTMLDivElement | HTMLInputElement>) => {
    setCurrEditAttrId("");
    setCurrEditFacet("");
  };

  return (
    <div className="data-card-tool">
      <DataCardToolbar
        model={model}
        documentContent={documentContent}
        tileElt={tileElt}
        currEditAttrId={currEditAttrId}
        currEditFacet={currEditFacet}
        setImageUrlToAdd={setImageUrlToAdd} {...toolbarProps}
        handleDeleteValue={deleteSelectedValue}
        handleDuplicateCard={duplicateCard}
      />
      <div className="data-card-content" onClick={handleBackgroundClick}>
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
            { !readOnly &&
              <div className="add-remove-card-buttons">
                <AddIconButton className={addCardClasses} onClick={addNewCase} />
                <RemoveIconButton className={removeCardClasses} onClick={handleDeleteCardClick} />
              </div>
            }
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
              currEditFacet={currEditFacet}
              setCurrEditAttrId={setCurrEditAttrId}
              setCurrEditFacet={setCurrEditFacet}
              imageUrlToAdd={imageUrlToAdd}
              setImageUrlToAdd={setImageUrlToAdd}
            />
          }
        </div>
        { shouldShowAddField && !readOnly &&
          <AddIconButton className="add-field" onClick={handleAddField} /> }
      </div>
    </div>
  );
});
DataCardToolComponent.displayName = "DataCardToolComponent";
