import classNames from "classnames";
import { observer } from "mobx-react";
import React, { useEffect, useState } from "react";
import { IToolTileProps } from "../../components/tools/tool-tile";
import { DeckContentModelType } from "./deck-content";
import { DeckCardData } from "./components/deck-card-data";

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

  const handleTitleKeyDown = (event:  React.KeyboardEvent<HTMLInputElement>) => {
    const { key } = event;
    if ( key === "Enter"){
      setIsEditing(false);
    }
  };

  // TODO hardcoded for now, will pull values from inputs like title
  // may be easier to move this down a level
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
          <div className="card-number-of-listing">
            Card { caseIndex + 1 } of { allCases.length }
          </div>
          <div className="card-nav-buttons">
            <button className={ previousButtonClasses  } onClick={previousCase}></button>
            <button className={ nextButtonClasses } onClick={nextCase}></button>
          </div>
          <div className="add-card-button">
            <button onClick={addCase}>
              {/* TODO: bring these in properly */}
              <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <g fill="none" fill-rule="evenodd">
                  <circle cx="12" cy="12" r="12"/>
                  <path d="M13 7h-2v4H7v2h4v4h2v-4h4v-2h-4V7zm-1-5C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="#0481A0"/>
                </g>
              </svg>
            </button>
          </div>
          <button className="delete-card">
            <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <g fill="none" fill-rule="evenodd">
                    <path d="M0 0h24v24H0z"/>
                    <circle cx="12" cy="12" r="12"/>
                    <path d="M7 11v2h10v-2H7zm5-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="#0481A0"/>
                </g>
            </svg>
          </button>
        </div>
        <div className="data-area">
          <DeckCardData caseIndex={caseIndex} model={model} />
        </div>
        <div className="add-attribute-area">
          {/* TODO: make this work, should be new component */}
          <div className="new-attribute">new attribute</div>
          <div className="new-value">new data</div>
        </div>
      </div>
    </div>
  );
});
DeckToolComponent.displayName = "DeckToolComponent";
