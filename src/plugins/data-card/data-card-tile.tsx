import classNames from "classnames";
import { observer } from "mobx-react";
import React, { useEffect, useRef, useState } from "react";
import { ITileProps, extractDragTileType, kDragTiles } from "../../components/tiles/tile-component";
import { useUIStore } from "../../hooks/use-stores";
import { DataCardContentModelType } from "./data-card-content";
import { DataCardRows } from "./components/data-card-rows";
import { DataCardToolbar } from "./data-card-toolbar";
import { SortSelect } from "./components/sort-select";
import { IsLinkedContext } from "./use-is-linked";
import { useToolbarTileApi } from "../../components/tiles/hooks/use-toolbar-tile-api";
import { AddIconButton, RemoveIconButton } from "./components/add-remove-icons";
import { useCautionAlert } from "../../components/utilities/use-caution-alert";
import { EditFacet } from "./data-card-types";
import { DataCardSortArea } from "./components/sort-area";
import { safeJsonParse } from "../../utilities/js-utils";
import { mergeTwoDataSets } from "../../models/data/data-set-utils";
import { CustomEditableTileTitle } from "../../components/tiles/custom-editable-tile-title";
import { useDataCardTileHeight } from "./use-data-card-tile-height";
import { DataCardToolbarContext } from "./data-card-toolbar-context";
import { CasesCountDisplay } from "./components/cases-count-display";

import "./data-card-tile.scss";

export const DataCardToolComponent: React.FC<ITileProps> = observer(function DataCardToolComponent(props) {
  const { documentId, model, readOnly, documentContent, tileElt, onSetCanAcceptDrop, onRegisterTileApi,
            scale, onRequestUniqueTitle, onUnregisterTileApi,
            height, onRequestRowHeight } = props;
  const backgroundRef = useRef<HTMLDivElement | null>(null);

  const content = model.content as DataCardContentModelType;
  const dataSet = content.dataSet;
  const linkedTiles = content.tileEnv?.sharedModelManager?.getSharedModelTiles(content.sharedModel);
  const isLinked = linkedTiles && linkedTiles.length > 1;
  const ui = useUIStore();

  const isTileSelected = ui.selectedTileIds.findIndex(id => id === content.metadata.id) >= 0;
  const [currEditAttrId, setCurrEditAttrId] = useState<string>("");
  const [currEditFacet, setCurrEditFacet] = useState<EditFacet>("");
  const [imageUrlToAdd, setImageUrlToAdd] = useState<string>("");
  const [highlightDataCard, setHighlightDataCard] = useState(false);

  const shouldShowAddCase = !readOnly && isTileSelected;
  const shouldShowDeleteCase = !readOnly && isTileSelected && dataSet.cases.length > 1;
  const displaySingle = !content.selectedSortAttributeId;
  const shouldShowAddField = !readOnly && isTileSelected && displaySingle;
  const attrIdsNames = content.existingAttributesWithNames();
  const cardOf = `Card ${content.caseIndex + 1 } of `;

  // When a highlighted case or cell is set, show it
  const selectedCaseId = dataSet.firstSelectedCaseId ? dataSet.firstSelectedCaseId : dataSet.firstSelectedCell?.caseId;
  useEffect(() => {
    if (selectedCaseId) {
      content.setCaseIndex(dataSet.caseIndexFromID(selectedCaseId));
    }
  }, [content, dataSet, selectedCaseId]);

  useEffect(() => {
    if (!model.computedTitle) {
      const title = onRequestUniqueTitle(model.id);
      title && model.setTitle(title);
    }
  }, [model, onRequestUniqueTitle]);

  useDataCardTileHeight({
    tileElt,
    height: height && isFinite(height) ? height : 0,
    currEditAttrId: currEditAttrId ?? "",
    modelId: model.id,
    documentId,
    readOnly: readOnly ?? false,
    onRequestRowHeight,
    attrCount: content.attributes.length,
    selectedSortId: content.selectedSortAttributeId
  });

  /* ==[ Drag and Drop ] == */

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    const isAcceptableDrag = isAcceptableDataCardDrag(e);
    onSetCanAcceptDrop(isAcceptableDrag ? model.id : undefined); //this turns off highlighting outer edge
  };

  const isAcceptableDataCardDrag =  (e: React.DragEvent<HTMLDivElement>) => {
    const draggingWithinItself = ui?.selectedTileIds.includes(model.id);
    if (draggingWithinItself){
      setHighlightDataCard(false);
      return false;
    }
    const tileTypeDragged = extractDragTileType(e.dataTransfer);
    const isDraggedTileDataCard = tileTypeDragged === "datacard"; //if two cards dragged, tileTypeDragged is undefined
    if (!readOnly && isDraggedTileDataCard) {
      const kImgDropMarginPct = 0.1;
      const eltBounds = e.currentTarget.getBoundingClientRect();
      const kImgDropMarginX = eltBounds.width * kImgDropMarginPct;
      const kImgDropMarginY = eltBounds.height * kImgDropMarginPct;
      if ((e.clientX > eltBounds.left + kImgDropMarginX) &&
          (e.clientX < eltBounds.right - kImgDropMarginX) &&
          (e.clientY > eltBounds.top + kImgDropMarginY) &&
          (e.clientY < ((eltBounds.bottom - kImgDropMarginY) * 0.95))){
        setHighlightDataCard(true); //within bounds
        return true;
      } else {
        setHighlightDataCard(false); //out of bounds
        return false;
      }
    }
    else { //not of type Datacard
      setHighlightDataCard(false);
      return false;
    }
  };

  const highlightContainerClasses = classNames(
    "data-card-container",
    {"highlight": highlightDataCard},
    {"no-highlight": !highlightDataCard}
  );

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {

    if (isAcceptableDataCardDrag(e)) {
      if (highlightDataCard) {
        setHighlightDataCard(false); //after you drop turn off highlighting
      }

      /* ==[ Merge dragged tile -> dropped tile ] == */
      const getDataDraggedTile = e.dataTransfer.getData(kDragTiles);
      const parsedDataDraggedTile = safeJsonParse(getDataDraggedTile);
      const contentOfDraggedTile= safeJsonParse(parsedDataDraggedTile.sharedModels[0].content);
      const dataSetOfDraggedTile = contentOfDraggedTile.dataSet;

      mergeTwoDataSets(dataSetOfDraggedTile, dataSet);
      e.preventDefault();
      e.stopPropagation(); //prevents calling document-content > handleDrop

      /* ==[ Delete tile (if within same document) ] == */
      const sourceDocIdDraggedTile = parsedDataDraggedTile.sourceDocId;
      const docIdDroppedTile = props.docId;
      const idDraggedTile = parsedDataDraggedTile.tiles[0].tileId;
      if (sourceDocIdDraggedTile === docIdDroppedTile){
        ui.removeTileIdFromSelection(idDraggedTile);
        // document.deleteTile(idDraggedTile);
        //TODO - document cannot be accessed, this would require a refactor
        //https://www.pivotaltracker.com/n/projects/2441242/stories/185129553
      }
    }
  };

  function nextCase() {
    if (content.caseIndex < content.totalCases - 1) {
      content.setCaseIndex(content.caseIndex + 1);
    }
  }

  const handleNextCase: React.MouseEventHandler<HTMLButtonElement> = e => {
    e.stopPropagation();
    nextCase();
  };

  function previousCase() {
    if (content.caseIndex > 0){
      content.setCaseIndex(content.caseIndex - 1);
    }
  }

  const handlePreviousCase: React.MouseEventHandler<HTMLButtonElement> = e => {
    e.stopPropagation();
    previousCase();
  };

  function setSort(event: React.ChangeEvent<HTMLSelectElement>){
    content.setSelectedSortAttributeId(event.target.value);
  }

  function addNewCase(){
    content.addNewCaseFromAttrKeys(content.existingAttributes());
    content.setCaseIndex(content.totalCases - 1);
  }

  const handleAddNewCase: React.MouseEventHandler<HTMLDivElement> = event => {
    event.stopPropagation();
    addNewCase();
  };

  function deleteCase(){
    if (content.caseId) {
      dataSet.removeCases([content.caseId]);
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

  const handleDeleteCardClick: React.MouseEventHandler<HTMLDivElement> = event => {
    event.stopPropagation();
    if (content.caseId){
      if (content.isEmptyCase(content.caseId)){
        deleteCase();
      } else {
        showAlert();
      }
    }
  };

  const handleAddField = () => {
    content.addNewAttr();
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
    // Prevents clicks on child elements
    if (event.target === backgroundRef.current) {
      setCurrEditAttrId("");
      setCurrEditFacet("");
      dataSet.clearAllSelections();
    }
  };

  const handleNavPanelClick = (event: React.MouseEvent<HTMLDivElement>) => {
    dataSet.setSelectedCases(content.caseId ? [content.caseId] : []);
  };

  return (
    <IsLinkedContext.Provider value={!!isLinked}>
      <div className={toolClasses}>
        <DataCardToolbarContext.Provider value={{currEditAttrId, currEditFacet}}>
          <DataCardToolbar
            model={model}
            documentContent={documentContent}
            tileElt={tileElt}
            currEditAttrId={currEditAttrId}
            currEditFacet={currEditFacet}
            setImageUrlToAdd={setImageUrlToAdd} {...toolbarProps}
            scale={scale}
          />
        </DataCardToolbarContext.Provider>
        <div
          className="data-card-content"
          onClick={handleBackgroundClick}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          ref={element => backgroundRef.current = element}
        >
          <div className={highlightContainerClasses}>
            <div className="data-card-header-row">
              <div className="panel title">
                <CustomEditableTileTitle
                  model={props.model}
                  onRequestUniqueTitle={props.onRequestUniqueTitle}
                  readOnly={props.readOnly}
                />
              </div>
            </div>

            <div className="panel sort">
              <SortSelect
                model={model}
                onSortAttrChange={setSort}
                attrIdNamePairs={attrIdsNames}
              />
              <div className="total-label">Total </div>
              <CasesCountDisplay totalCases={content.totalCases} />
            </div>
            { displaySingle &&
              <div className="single-card-view-wrap">
                <div
                  className={classNames("panel nav", { highlighted: content.caseSelected, linked: isLinked })}
                  onClick={handleNavPanelClick}
                >
                  <div className="card-number-of-listing">
                    <span>{cardOf}</span>
                    <div className="cell-text">
                        { content.totalCases > 0 &&
                          <CasesCountDisplay totalCases={content.totalCases} />
                        }
                        { (!content.totalCases || content.totalCases < 1) && <>Add a card</> }
                    </div>
                  </div>
                  <div className="card-nav-buttons">
                    <button className={ previousButtonClasses } onClick={handlePreviousCase}></button>
                    <button className={ nextButtonClasses } onClick={handleNextCase}></button>
                  </div>
                  { !readOnly &&
                    <div className="add-remove-card-buttons">
                      <AddIconButton className={addCardClasses} onClick={handleAddNewCase} />
                      <RemoveIconButton className={removeCardClasses} onClick={handleDeleteCardClick} />
                    </div>
                  }
                </div>
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
    </IsLinkedContext.Provider>
  );
});
