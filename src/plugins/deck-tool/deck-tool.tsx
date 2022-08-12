import { observer } from "mobx-react";
import React, { useEffect, useState } from "react";
import { IToolTileProps } from "../../components/tools/tool-tile";
import { DeckContentModelType } from "./deck-content";

import "./deck-tool.scss";

export const DeckToolComponent: React.FC<IToolTileProps> = observer((props) => {
  const { documentContent, model } = props;
  const content = model.content as DeckContentModelType;

  const setDefaultTitle = () => {
    if (!content.metadata.title || content.metadata.title === ""){
      const count = documentContent?.getElementsByClassName('deck-tool-tile').length
      content.setTitle(`Deck ${ count ? count : "1" }`)
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
  })

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    content.setTitle(event.target.value);
  };

  return (
    <div className="deck-tool" style={{ border: "3px dashed silver", padding: "6px" }}>
      <textarea value={content.metadata.title} onChange={handleChange} />
    </div>
  );
});
DeckToolComponent.displayName = "DeckToolComponent";