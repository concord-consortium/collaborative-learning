import classNames from "classnames";
import { observer } from "mobx-react";
import React, { useEffect, useState } from "react";
import { IToolTileProps } from "../../components/tools/tool-tile";
import { DeckContentModelType } from "./deck-content";

import "./deck-tool.scss";

export const DeckToolComponent: React.FC<IToolTileProps> = observer((props) => {
  const { documentContent, model, readOnly } = props;
  const content = model.content as DeckContentModelType;
  const [isEditing, setIsEditing] = useState(false);
  const [caseIndex, setCaseIndex] = useState(0);
  const [canIncrement, setCanIncrement] = useState(true);
  const [canDecrement, setCanDecrement] = useState(false);

  const allCases = content.allCases();

  function nextCase(){
    if ( caseIndex < allCases.length - 1 ) {
      setCaseIndex(caseIndex + 1);
    }
  }

  function previousCase(){
    if (caseIndex > 0){
      setCaseIndex(caseIndex - 1);
    }
  }

  useEffect(()=>{
    setCanDecrement(caseIndex > 0);
    setCanIncrement(caseIndex < allCases.length - 1);
  },[caseIndex]);

  const dataForCase = () => {
    const thisCase = content.caseByIndex(caseIndex);
    if (thisCase){
      const keysHere = Object.keys(thisCase).filter(k => k !== "__id__");
      const caseData = keysHere.map((k) => {
        const attrName = content.attrById(k).name;
        return thisCase ? { a: attrName, v: thisCase[k]} : undefined;
      });

      return (
        <div className="data-for-item">
          {caseData.map((theCase, i) => {
            return (
              <div key={i}><b>{theCase?.a}:</b> {theCase?.v}</div>
            );
          })}
        </div>
      );
    }
  };

  const setDefaultTitle = () => {
    if (!content.metadata.title || content.metadata.title === ""){
      const count = documentContent?.getElementsByClassName('deck-tool-tile').length;
      content.setTitle(`Data Card Collection ${ count ? count : "1" }`);
    }
  };

  useEffect(() => {
    setDefaultTitle();
  }, []);

  useEffect(() => {
    setTimeout(() => {
      setDefaultTitle();
    }, 2000);
  },[content.metadata.title]);

  const handleTitleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    content.setTitle(event.target.value);
  };

  const handleTitleClick = (event: any) => {
    if (!readOnly){
      setIsEditing(true);
    }
  };

  // This is a generic setter for dummy data in development, will be removed
  const handleDescriptionChange = (event: any) => {
    if (!readOnly) {
      content.setDescription(event.target.value);
    }
  };

  const handleTitleKeyDown = (event:  React.KeyboardEvent<HTMLInputElement>) => {
    const { key } = event;
    if ( key === "Enter"){
      setIsEditing(false);
    }
  };

  // hardcoded for now, will pull values from inputs like title
  function addCase(){
    content.dataSet.addCanonicalCasesWithIDs([
      { __id__: "nachoMoth", mothName: "Nacho Moth", sciName: "Cladara Tortillus", captureDate: "9/3/21" },
    ]);
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
              onBlur={() => setIsEditing(false)}
          />
          : <div className="editable-deck-title-text" onClick={handleTitleClick}>
              { content.metadata.title }
            </div>
          }
        </div>
        <div className="panel nav">
          Card { caseIndex + 1 } of { allCases.length }
          <button className={ previousButtonClasses  } onClick={previousCase}>previous</button>
          <button className={ nextButtonClasses } onClick={nextCase}>next</button>
          <button onClick={addCase}>+</button>
        </div>
        <div className="data-area-wrap">
          { dataForCase() }
        </div>
      </div>
    </div>
  );
});
DeckToolComponent.displayName = "DeckToolComponent";
