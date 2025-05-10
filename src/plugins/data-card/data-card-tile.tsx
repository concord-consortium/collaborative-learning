import classNames from "classnames";
import { observer } from "mobx-react";
import { isAlive } from "mobx-state-tree";
import React, { useRef, useState, useEffect } from "react";
import { ITileProps } from "../../components/tiles/tile-component";
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
import { CustomEditableTileTitle } from "../../components/tiles/custom-editable-tile-title";
import { DataCardToolbarContext } from "./data-card-toolbar-context";
import { CasesCountDisplay } from "./components/cases-count-display";
import { useDataCardTileHeight } from "./use-data-card-tile-height";

import "./data-card-tile.scss";

export const DataCardToolComponent: React.FC<ITileProps> = observer(function DataCardToolComponent(props) {
  const { documentId, model, readOnly, documentContent, tileElt, onRegisterTileApi,
          scale, onUnregisterTileApi, height, onRequestRowHeight } = props;
  // Doing this check lets mobx know that it shouldn't try to render a model that has been deleted
  if (!isAlive(model)) {
    console.log("rendering unalive model", model);
  }

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

  const shouldShowAddCase = !readOnly && isTileSelected;
  const shouldShowDeleteCase = !readOnly && isTileSelected && dataSet.cases.length > 1;
  const displaySingle = !content.selectedSortAttributeId;
  const shouldShowAddField = !readOnly && isTileSelected && displaySingle;
  const attrIdsNames = content.existingAttributesWithNames();
  const cardOf = `Card ${content.caseIndexNumber + 1 } of `;

  // When a highlighted case or cell is set, show it
  const selectedCaseId = dataSet.firstSelectedCaseId !== undefined
    ? dataSet.firstSelectedCaseId : dataSet.firstSelectedCell?.caseId;
  useEffect(() => {
    // caseIndex is undefined when the tile is first created.
    // The initial setting of this field must be handled `updateAfterSharedModelChanges`,
    // so that it is part of the same history entry as the tile creation. Setting it here would mean
    // creating a second history entry that might be out of order.
    if (content.caseIndex === undefined) return;
    if (selectedCaseId !== undefined && dataSet.caseIndexFromID(selectedCaseId) !== content.caseIndex) {
      content.setCaseIndex(dataSet.caseIndexFromID(selectedCaseId));
    }
  }, [content, dataSet, selectedCaseId]);

  useDataCardTileHeight({
    tileElt,
    height: height && isFinite(height) ? height : 0,
    currEditAttrId: currEditAttrId ?? "",
    modelId: model.id,
    documentId,
    readOnly: readOnly ?? false,
    onRequestRowHeight,
    attrCount: content.attributes.length,
    isSingleView: displaySingle
  });

  function nextCase() {
    if (content.caseIndexNumber < content.totalCases - 1) {
      content.setCaseIndex(content.caseIndexNumber + 1);
    }
  }

  const handleNextCase: React.MouseEventHandler<HTMLButtonElement> = e => {
    e.stopPropagation();
    nextCase();
  };

  function previousCase() {
    if (content.caseIndexNumber > 0){
      content.setCaseIndex(content.caseIndexNumber - 1);
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
    content.caseIndexNumber > 0 ? "active" : "disabled",
  );
  const nextButtonClasses = classNames(
    "card-nav", "next",
    content.caseIndexNumber < content.totalCases - 1 ? "active" : "disabled",
  );
  const addCardClasses = classNames("add-card", "teal-bg", { hidden: !shouldShowAddCase });
  const removeCardClasses = classNames("remove-card", { hidden: !shouldShowDeleteCase });
  const toolClasses = classNames(
    "tile-content", "data-card-tool", `display-as-${ displaySingle ? 'single' : 'sorted'}`
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
          ref={element => backgroundRef.current = element}
        >
          <div className="data-card-container">
            <div className="data-card-header-row">
              <div className="panel title">
                <CustomEditableTileTitle
                  model={props.model}
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
                      caseIndex={content.caseIndexNumber}
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
