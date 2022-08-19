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
  const [isEditing, setIsEditing] = useState(false);
  const [caseIndex, setCaseIndex] = useState(0);
  const [totalCases, setTotalCases] = useState(0);
  const [canIncrement, setCanIncrement] = useState(true);
  const [canDecrement, setCanDecrement] = useState(false);
  const [hideDelete, setHideDelete] = useState(false)

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
    console.log("testing totalCases: ", totalCases)
    if (totalCases === 0 ){
      return true;
    }

    if (totalCases === 1){
      const firstCaseId = content.dataSet.caseIDFromIndex(0);

      if (firstCaseId){
        const firstCase = content.dataSet.getCanonicalCase(firstCaseId)
        const someValue =  firstCase?.label1?.toString();
        console.log("length of first val: ", someValue?.length);
        return someValue?.length === 0;
      }
    }

    else {
      return false;
    }
  }

  useEffect(() => {
    setTotalCases(content.totalCases());
    console.log("effect setTotalCases to: ", totalCases);
  });

  useEffect(()=>{
    setCanDecrement(caseIndex > 0);
    setCanIncrement(caseIndex < totalCases - 1);
    setHideDelete(shouldHideDelete() || false)
  },[caseIndex, totalCases]);

  useEffect(()=>{
    goToLatestCase();
  }, [totalCases])

  const setDefaultTitle = () => {
    if (!content.metadata.title || content.metadata.title === ""){
      const count = documentContent?.getElementsByClassName('deck-tool-tile').length;
      content.setTitle(`Data Card Collection ${ count ? count : "1" }`);
    }
  };

  useEffect(()=>{
    setDefaultTitle();
  },[])

  const handleTitleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    content.setTitle(event.target.value);
  };

  const handleTitleClick = () => {
    if (!readOnly){
      setIsEditing(true);
    }
  };

  const handleTitleKeyDown = (event:  React.KeyboardEvent<HTMLInputElement>) => {
    const { key } = event;
    if ( key === "Enter"){
      setIsEditing(false);
    }
  };

  const handleTitleBlur = (e: any) => {
    if (content.metadata.title === ""){
      setDefaultTitle();
    }
    setIsEditing(false);
  };

  function addNewCase(){
    content.addNewCase(content.existingAttributes());
    setTotalCases(content.totalCases());
  }

  function deleteCase(){
    const thisCaseId = content.dataSet.caseIDFromIndex(caseIndex);
    if (thisCaseId) {
      content.dataSet.removeCases([thisCaseId]);
    }
    setTotalCases(content.totalCases());
  }

  function goToLatestCase(){
    console.log("given currentIndex: ", caseIndex, "totalCases: ", totalCases, "what index should I go to?");
    setCaseIndex(totalCases - 1);
  }

  const previousButtonClasses = classNames(
    "card-nav", "previous",
    canDecrement ? "active" : "disabled",
  );

  const nextButtonClasses = classNames(
    "card-nav", "next",
    canIncrement ? "active" : "disabled",
  );

  return (
    <div className="deck-tool">
      <div className="deck-toolbar">
        <div className="panel title">
          { isEditing
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
            <button onClick={addNewCase}>
              <AddDataCardIcon />
            </button>
          </div>
          { !hideDelete &&
            <button className="delete-card" onClick={deleteCase}>
              <RemoveDataCardIcon />
            </button>
          }
        </div>
        <div className="data-area">
          <DeckCardData caseIndex={caseIndex} model={model} totalCases={totalCases} readOnly={readOnly} />
        </div>
      </div>
      <div>replace me with image toolbar component</div>
    </div>
  );
});
DeckToolComponent.displayName = "DeckToolComponent";
