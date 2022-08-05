import classNames from "classnames";
import { observer } from "mobx-react";
import React, { useEffect, useState } from "react";
import { IToolTileProps } from "../../components/tools/tool-tile";
import { DeckContentModelType } from "./deck-content";
import { DeckCardData } from "./components/deck-card-data";
import AddDataCardIcon from "./assets/add-data-card-icon.svg";
import RemoveDataCardIcon from "./assets/remove-data-card-icon.svg";

import "./deck-tool.scss";

export const DeckToolComponent: React.FC<IToolTileProps> = observer((props) => {
  const { documentContent, model, readOnly } = props;
  const content = model.content as DeckContentModelType;
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [caseIndex, setCaseIndex] = useState(0);
  const [totalCases, setTotalCases] = useState(content.totalCases());
  const [hideDelete, setHideDelete] = useState(false);

  useEffect(() => {
    setDefaultTitle();
  }, [content]);

  useEffect(()=>{
    setHideDelete(shouldHideDelete() || false);
  },[caseIndex, totalCases]);

  function nextCase(){
    if ( caseIndex < totalCases - 1 ) {
      setCaseIndex(caseIndex + 1);
    }
  }

  function previousCase(){
    if (caseIndex > 0){
      setCaseIndex(caseIndex - 1);
    }
  }

  function shouldHideDelete(){
    return totalCases < 1;
  }

  const setDefaultTitle = () => {
    if (!content.metadata.title || content.metadata.title === ""){
      const count = documentContent?.getElementsByClassName('deck-tool-tile').length;
      content.setTitle(`Data Card Collection ${ count ? count : "1" }`);
    }
  };

  const handleTitleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    content.setTitle(event.target.value);
  };

  const handleTitleClick = () => {
    if (!readOnly){
      setIsEditingTitle(true);
    }
  };

  const handleTitleKeyDown = (event:  React.KeyboardEvent<HTMLInputElement>) => {
    const { key } = event;
    if ( key === "Enter" || key === "Escape"){
      setIsEditingTitle(false);
    }
  };

  const handleTitleBlur = (e: any) => {
    if (content.metadata.title === ""){
      setDefaultTitle();
    }
    setIsEditingTitle(false);
  };

  function addNewCase(){
    content.addNewCaseFromAttrKeys(content.existingAttributes());
    setTotalCases(totalCases + 1);
    setCaseIndex(totalCases);
  }

  function deleteCase(){
    // TODO modal (see src/components/delete-button)
    const thisCaseId = content.dataSet.caseIDFromIndex(caseIndex);
    if (thisCaseId) {
      content.dataSet.removeCases([thisCaseId]);
    }
    setTotalCases(totalCases - 1);
    previousCase();
  }

  const previousButtonClasses = classNames(
    "card-nav", "previous",
    caseIndex > 0 ? "active" : "disabled",
  );

  const nextButtonClasses = classNames(
    "card-nav", "next",
    caseIndex < totalCases - 1 ? "active" : "disabled",
  );

  return (
    <div className="deck-tool">
      <div className="deck-toolbar">
        <div className="panel title">
          { isEditingTitle && !readOnly
          ? <input
              className="deck-title-input-editing"
              value={content.metadata.title}
              onChange={handleTitleChange}
              onKeyDown={handleTitleKeyDown}
              onBlur={handleTitleBlur}
          />
          : <div className="editable-deck-title-text" onClick={handleTitleClick}>
              { content.metadata.title }
            </div>
          }
        </div>
        <div className="panel nav">
          <div className="card-number-of-listing">
            { totalCases > 0
              ? <>Card { caseIndex + 1 } of { totalCases } </>
              : <>Add a card</>
            }
          </div>
          <div className="card-nav-buttons">
            <button className={ previousButtonClasses  } onClick={previousCase}></button>
            <button className={ nextButtonClasses } onClick={nextCase}></button>
          </div>
          <div className="add-card-button">
            { !readOnly &&
              <button onClick={addNewCase}>
                <AddDataCardIcon />
              </button>
            }
          </div>
          { !hideDelete && !readOnly &&
            <button className="delete-card" onClick={deleteCase}>
              <RemoveDataCardIcon />
            </button>
          }
        </div>
      </div>
      <div className="data-area">
        { totalCases > 0 &&
          <DeckCardData
            caseIndex={caseIndex}
            model={model}
            totalCases={totalCases}
            readOnly={readOnly}
          />
        }
      </div>
      {/* <div>replace me with image toolbar component</div> */}
    </div>
  );
});
DeckToolComponent.displayName = "DeckToolComponent";
