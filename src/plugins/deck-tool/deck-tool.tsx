import { observer } from "mobx-react";
import React, { useEffect, useState } from "react";
import { IToolTileProps } from "../../components/tools/tool-tile";
import { DeckContentModelType } from "./deck-content";

import "./deck-tool.scss";

export const DeckToolComponent: React.FC<IToolTileProps> = observer((props) => {
  const { documentContent, model } = props;
  const content = model.content as DeckContentModelType;

  const [isEditing, setIsEditing] = useState(false);

  const setDefaultTitle = () => {
    if (!content.metadata.title || content.metadata.title === ""){
      const count = documentContent?.getElementsByClassName('deck-tool-tile').length
      content.setTitle(`Data Card Collection ${ count ? count : "1" }`)
    }
  }

  // on first load of tile, set default title
  useEffect(() => {
    setDefaultTitle();
  }, []);

  // if user erases title, give them a moment and then reset default
  useEffect(() => {
    setTimeout(() => {
      setDefaultTitle();
    }, 2000);
  },[content.metadata.title])

  const handleTitleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    content.setTitle(event.target.value);
  };

  const handleTitleClick = (event: any) => {
    setIsEditing(true)
  }

  const handleTitleKeyDown = (event:  React.KeyboardEvent<HTMLInputElement>) => {
    const { key } = event;
    console.log("key: ", key)
    if ( key === "Enter"){
      setIsEditing(false);
    }
  }

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
          Card 1 of 1
        </div>
      </div>
    </div>
  );
});
DeckToolComponent.displayName = "DeckToolComponent";