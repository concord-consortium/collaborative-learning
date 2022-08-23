import classNames from "classnames";
import { observer } from "mobx-react";
import React, { useEffect, useState } from "react";
import { IToolTileProps } from "../../components/tools/tool-tile";
import { useUIStore } from "../../hooks/use-stores";
import { DataCardContentModelType } from "./data-card-content";
import { DataCardRows } from "./components/data-card-rows";
import { AddIconButton, RemoveIconButton } from "./components/add-remove-icons";

import "./data-card-tool.scss";

export const DataCardToolComponent: React.FC<IToolTileProps> = observer((props) => {
  const { model, onRequestUniqueTitle, readOnly } = props;
  const content = model.content as DataCardContentModelType;
  const ui = useUIStore();
  const isTileSelected = ui.selectedTileIds.findIndex(id => id === content.metadata.id) >= 0;
  const [titleValue, setTitleValue] = useState(content.title);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [caseIndex, setCaseIndex] = useState(0);
  const shouldShowAddCase = !readOnly && isTileSelected;
  const shouldShowDeleteCase = !readOnly && isTileSelected && content.dataSet.cases.length > 1;
  const shouldShowAddField = !readOnly && isTileSelected;
  // const shouldShowDeleteField = !readOnly && isTileSelected && content.dataSet.attributes.length > 1;

  useEffect(() => {
    if (!content.title) {
      const title = onRequestUniqueTitle(model.id);
      title && content.setTitle(title);
    }
  }, [content, model.id, onRequestUniqueTitle]);

  function nextCase(){
    if (caseIndex < content.totalCases - 1) {
      setCaseIndex(currCaseIndex => ++currCaseIndex);
    }
  }

  function previousCase(){
    if (caseIndex > 0){
      setCaseIndex(currCaseIndex => --currCaseIndex);
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
    setCaseIndex(content.totalCases - 1);
  }

  function deleteCase(){
    // TODO modal (see src/components/delete-button)
    const thisCaseId = content.dataSet.caseIDFromIndex(caseIndex);
    if (thisCaseId) {
      content.dataSet.removeCases([thisCaseId]);
    }
    previousCase();
  }

  const handleAddField = () => {
    content.addNewAttr();
  };

  const previousButtonClasses = classNames(
    "card-nav", "previous",
    caseIndex > 0 ? "active" : "disabled",
  );

  const nextButtonClasses = classNames(
    "card-nav", "next",
    caseIndex < content.totalCases - 1 ? "active" : "disabled",
  );

  const addCardClasses = classNames("add-card", "teal-bg", { hidden: !shouldShowAddCase });
  const removeCardClasses = classNames("remove-card", { hidden: !shouldShowDeleteCase });

  return (
    <div className="data-card-tool">
      <div className="data-card-toolbar">
        <div className="panel title">
          { isEditingTitle && !readOnly
          ? <input
              className="data-card-title-input-editing"
              value={titleValue}
              onChange={handleTitleChange}
              onKeyDown={handleTitleKeyDown}
              onBlur={handleCompleteTitle}
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
                  ? `Card ${caseIndex + 1} of ${content.totalCases}`
                  : "Add a card" }
            </div>
          </div>
          <div className="card-nav-buttons">
            <button className={ previousButtonClasses } onClick={previousCase}></button>
            <button className={ nextButtonClasses } onClick={nextCase}></button>
          </div>
          <div className="add-remove-card-buttons">
            <AddIconButton className={addCardClasses} onClick={addNewCase} />
            <RemoveIconButton className={removeCardClasses} onClick={deleteCase} />
          </div>
        </div>
      </div>
      <div className="data-area">
        { content.totalCases > 0 &&
          <DataCardRows
            caseIndex={caseIndex}
            model={model}
            totalCases={content.totalCases}
            readOnly={readOnly}
          />
        }
      </div>
      { shouldShowAddField &&
        <AddIconButton className="add-field" onClick={handleAddField} /> }
    </div>
  );
});
DataCardToolComponent.displayName = "DataCardToolComponent";
