import classNames from "classnames";
import { observer } from "mobx-react";
import React, { useEffect, useState } from "react";
import { ITileProps } from "../../components/tiles/tile-component";
import { useUIStore } from "../../hooks/use-stores";
import { addCanonicalCasesToDataSet } from "../../models/data/data-set";
import { DataCardContentModelType } from "./data-card-content";
import { DataCardRows } from "./components/data-card-rows";
import { DataCardToolbar } from "./data-card-toolbar";
import { SortSelect } from "./components/sort-select";
import { useToolbarTileApi } from "../../components/tiles/hooks/use-toolbar-tile-api";
import { AddIconButton, RemoveIconButton } from "./components/add-remove-icons";
import { useCautionAlert } from "../../components/utilities/use-caution-alert";
import { EditFacet } from "./data-card-types";
import { DataCardSortArea } from "./components/sort-area";

import "./data-card-tile.scss";

//TODO:
//Study https://github.com/concord-consortium/collaborative-learning/pull/1691

//Tasks
//Data Card tiles can be dragged onto each other from the usual corner drag mechanism, resulting in a single tile with all the cards from both decks.
//target deck should light up around the outside edge when the drag will merge it.
// if a toolbar to merge (brings up list of mergeable decks) is easier than drag do that.
// merged (dragged) deck tile is removed.
// Number of cards will be the sum of the card count in the two tiles.
// Data fields will the the union of the two field set names. If each deck has unique fields the resulting cards have more fields: deck1fields + deck2fields, with blank data for the added fields on each card.
// Data is available in the document model
// Image data remains visible
// new larger deck can be sorted to resolve any field differences in spelling or capitalization

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
  const displaySingle = !content.selectedSortAttributeId;
  const shouldShowAddField = !readOnly && isTileSelected && displaySingle;
  const attrIdsNames = content.existingAttributesWithNames();

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

  function setSort(event: React.ChangeEvent<HTMLSelectElement>){
    content.setSelectedSortAttributeId(event.target.value);
  }

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
    if (copyableCase) {
      // strip __id__ so a new id will be generated on insertion
      const { __id__, ...canonicalCase } = copyableCase;
      const desiredIndex = originalCaseIndex + 1;
      const beforeId = content.dataSet.caseIDFromIndex(desiredIndex);
      addCanonicalCasesToDataSet(content.dataSet, [canonicalCase], beforeId);
      content.setCaseIndex(desiredIndex);
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

  const toolClasses = classNames(
    "data-card-tool", `display-as-${ displaySingle ? 'single' : 'sorted'}`
  );

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
    <div className={toolClasses}>
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
        </div>

        <div className="panel sort">
          <SortSelect
            model={model}
            onSortAttrChange={setSort}
            attrIdNamePairs={attrIdsNames}
          />
        </div>

        { displaySingle &&
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
        }
        { displaySingle &&
          <div className="single-card-data-area">
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
        }
        { shouldShowAddField && !readOnly &&
          <AddIconButton className="add-field" onClick={handleAddField} />
        }
        { !displaySingle &&
          <div className="sorting-cards-data-area">
            <DataCardSortArea model={model} />
          </div>
        }
      </div>
    </div>
  );
});
DataCardToolComponent.displayName = "DataCardToolComponent";
