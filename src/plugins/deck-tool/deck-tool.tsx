import { observer } from "mobx-react";
import React, { useEffect, useState } from "react";
import { IToolTileProps } from "../../components/tools/tool-tile";
import { DeckContentModelType } from "./deck-content";

import "./deck-tool.scss";

export const DeckToolComponent: React.FC<IToolTileProps> = observer((props) => {
  const { documentContent, model } = props;
  const content = model.content as DeckContentModelType;

  const setDefaultTitle = () => {
    const count = documentContent?.getElementsByClassName('deck-tool-tile').length
    content.setTitle(`Data Card Collection ${ count ? count : "1" }`)
  }

  useEffect(() => {
      setTimeout(()=>{
        if (content.metadata.title === ""){
          setDefaultTitle()
        }
      }, 2000)
  })

  useEffect(() => {
    if (!content.metadata.title){
      setDefaultTitle();
    }
  }, [])

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