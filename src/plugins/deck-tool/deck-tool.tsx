import { observer } from "mobx-react";
import React, { useEffect, useState } from "react";
import { IToolTileProps } from "../../components/tools/tool-tile";
import { DeckContentModelType } from "./deck-content";

import "./deck-tool.scss";

export const DeckToolComponent: React.FC<IToolTileProps> = observer((props) => {
  const { documentContent, model, readOnly } = props;
  const content = model.content as DeckContentModelType;

 // console.log("raw model", model)

  const [caseIndex, setCaseIndex] = useState(0)

  function nextCase(){
    if (caseIndex !== 1) //hardcoding for now, will compare with total cases length
    setCaseIndex(caseIndex + 1)
  }

  function previousCase(){
    if (caseIndex > 0){
      setCaseIndex(caseIndex - 1)
    }
  }

  const dataForThisCase = () => {
    const thisCase = content.caseByIndex(caseIndex);
    return (
      <div className="data-for-item">
        <b>Moth Name:</b> {thisCase?.mothName}<br/>
        <b>Scientific Name:</b> {thisCase?.sciName}<br/>
        <b>Capture Date:</b> {thisCase?.captureDate}<br/>
      </div>
    )
    //return "data for this case"
    // const bob = content.attributes.map((a) => {
    //   return <div className="attribute-title">{ a.name }</div>
    // })
    // console.log(bob)
    // return bob;
  }

  const all = content.allCases();
  //console.log(all);


  // const maybe = content.attributes.map((attr) => {
  //   console.log("ATTR: ", attr.name);
  // })

  //console.log("content.attributes because we have get attributes() ", content.attributes)
  const [isEditing, setIsEditing] = useState(false);
  const dummyDescriptionDataOn = false; //TODO - remove this, for dev only

  const setDefaultTitle = () => {
    if (!content.metadata.title || content.metadata.title === ""){
      const count = documentContent?.getElementsByClassName('deck-tool-tile').length;
      content.setTitle(`Data Card Collection ${ count ? count : "1" }`);
    }
  };

  // on first load of tile, set default title
  useEffect(() => {
    setDefaultTitle();
  }, []);

  // if user erases title, give them a moment and then reset default
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
          Card { caseIndex + 1 } of { all.length }
          <button onClick={previousCase}>previous</button>
          <button onClick={nextCase}>next</button>
        </div>
        <div className="data-area-wrap">
          { dataForThisCase() }
        </div>
        { dummyDescriptionDataOn && <textarea value={content.deckDescription} onChange={handleDescriptionChange} /> }
      </div>
    </div>
  );
});
DeckToolComponent.displayName = "DeckToolComponent";
