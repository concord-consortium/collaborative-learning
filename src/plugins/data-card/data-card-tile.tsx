import classNames from "classnames";
import { observer } from "mobx-react";
import React, { useEffect, useState } from "react";
import { ITileProps, kDragTileContent, kDragTiles } from "../../components/tiles/tile-component";
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
// import { DataCardDragDrop } from "./data-card-drag-drop";

import "./data-card-tile.scss";
// import { ImageDragDrop } from "../../components/utilities/image-drag-drop";
import { safeJsonParse } from "../../utilities/js-utils";


export const DataCardToolComponent: React.FC<ITileProps> = observer((props) => {
  const { model, onRequestUniqueTitle, readOnly, documentContent, tileElt, onSetCanAcceptDrop, onRegisterTileApi,
            onUnregisterTileApi } = props;
  console.log("< DataCardToolComponent >");
  const content = model.content as DataCardContentModelType;
  const ui = useUIStore();
  const isTileSelected = ui.selectedTileIds.findIndex(id => id === content.metadata.id) >= 0;
  // console.log("< DataCardToolComponent > with tileId:", model.id);

  const [titleValue, setTitleValue] = useState(content.title);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [currEditAttrId, setCurrEditAttrId] = useState<string>("");
  const [currEditFacet, setCurrEditFacet] = useState<EditFacet>("");
  const [imageUrlToAdd, setImageUrlToAdd] = useState<string>("");
  const [highlightDataCard, setHighlightDataCard] = useState(false);

  const shouldShowAddCase = !readOnly && isTileSelected;
  const shouldShowDeleteCase = !readOnly && isTileSelected && content.dataSet.cases.length > 1;
  const displaySingle = !content.selectedSortAttributeId;
  const shouldShowAddField = !readOnly && isTileSelected && displaySingle;
  const attrIdsNames = content.existingAttributesWithNames();

  // let highlightContainerClasses = "data-card-container";
  const highlightContainerClasses = classNames(
    "data-card-container", {"highlight": highlightDataCard},
    {"no-highlight": !highlightDataCard});

  console.log('highlightContainerClasses:', highlightContainerClasses);

  useEffect(() => {
    if (!content.title) {
      const title = onRequestUniqueTitle(model.id);
      title && content.setTitle(title);
    }
  }, [content, model.id, onRequestUniqueTitle]);

  /* ==[ Drag n Drop ] == */
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // console.log("handleMouseDown");
  };

  //taken from drawing-layer > handleDragOver, disables outer edge highlights
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    const isAcceptableDrag = isAcceptableDataCardDrag(e);
    onSetCanAcceptDrop(isAcceptableDrag ? model.id : undefined); //this turns off highlighting outer edge
    if (isAcceptableDrag) {
      // console.log("< data-card-tile.tsx > copying-over");
      e.dataTransfer.dropEffect = "copy";
      e.preventDefault();
    }
  };

  const isAcceptableDataCardDrag =  (e: React.DragEvent<HTMLDivElement>) => {
    // image drop area is central 80% in each dimension
//     local document id = parsedContent source doc id
    // const getData = e.dataTransfer.getData(kDragTiles);
    // const parsedData = safeJsonParse(getData);
    // const tilesSelected = parsedData?.tiles;
    // console.log("tilesSelected:", tilesSelected);
    // if (tilesSelected){
    //   const isSameTile = !!tilesSelected.find((tile: any)=>{ //true if we drag data card onto itself
    //     return tile.tileId === model.id;
    //   });
    //   // console.log("isSameTile:", isSameTile);
    //   if (!isSameTile){ //transfer Data
    //     // console.log("in if statement");
    //   }

    // } else {
    //   console.log("returning false");
    //   return false;
    // }
    const numTilesDragged = ui?.selectedTileIds.length; //this may change
    //check if current id is inside of selected Tiles
    const draggingWithinItself = ui?.selectedTileIds.includes(model.id);
    //  local document id = parsedContent source doc id

    console.log("ui is....", ui);

    if (draggingWithinItself){
      setHighlightDataCard(false);
      return false;
    }
    if (!readOnly && numTilesDragged >= 1) {
      const kImgDropMarginPct = 0.1;
      const eltBounds = e.currentTarget.getBoundingClientRect();
      console.log("eltBounds:", eltBounds);
      const kImgDropMarginX = eltBounds.width * kImgDropMarginPct;
      const kImgDropMarginY = eltBounds.height * kImgDropMarginPct;
      // console.log("eltBounds.bottom - kImgDropMarginY", eltBounds.bottom - kImgDropMarginY);
      // console.log("clientY:", e.clientY);
      // console.log("//1:", (e.clientY > eltBounds.top + kImgDropMarginY)); //1
      // console.log("//1 bounds:", eltBounds.top + kImgDropMarginY);
      // console.log("//2:", (e.clientY < eltBounds.bottom - kImgDropMarginY)); //2
      // console.log("//2 bounds:", eltBounds.bottom - kImgDropMarginY);

      if ((e.clientX > eltBounds.left + kImgDropMarginX) &&
          (e.clientX < eltBounds.right - kImgDropMarginX) &&
          (e.clientY > eltBounds.top + kImgDropMarginY) && //1
          (e.clientY < ((eltBounds.bottom - kImgDropMarginY)*0.95))){ //2
        console.log("within bounds!");
        setHighlightDataCard(true);
        return true;

      } else {
        console.log("out of bounds!");
        console.log(("returning false"));
        setHighlightDataCard(false);
        return false;
      }

    }


  };


  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    if (isAcceptableDataCardDrag(e)) {
      console.log("VALID DROPPPED!!!!");
      if (highlightDataCard) setHighlightDataCard(false);

      // console.log("parsedContent:", parsedContent);
      // if (parsedContent) {
      //   const droppedContent: ImageContentSnapshotOutType = parsedContent.content;
      //   const droppedUrl = droppedContent.url;
      //   if (droppedUrl) {
      //     this.handleImageDrop(droppedUrl);
      //   }
      //   e.preventDefault();
      //   e.stopPropagation();
      // }
    }
  };

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
      {/* {console.log("data-card-tile render(): highlightDataCard:", highlightDataCard)} */}
      {/* {console.log("data-card-tile render(): highlightDataCardClasses:", highlightContainerClasses)} */}

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
      {highlightDataCard ? "T": "F"}
      <div
        className="data-card-content"
        onClick={handleBackgroundClick}
        onMouseDown={handleMouseDown} //maybe get rid of
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >

        <div className={highlightContainerClasses}>
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
    </div>
  );
});
DataCardToolComponent.displayName = "DataCardToolComponent";
