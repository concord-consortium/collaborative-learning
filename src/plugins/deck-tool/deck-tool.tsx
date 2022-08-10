import { observer } from "mobx-react";
import React, { useEffect } from "react";
import { IToolTileProps } from "../../components/tools/tool-tile";
import { DeckContentModelType } from "./deck-content";

import "./deck-tool.scss";

export const DeckToolComponent: React.FC<IToolTileProps> = observer((props) => {
  const { onRegisterToolApi, model } = props;

  const content = model.content as DeckContentModelType;

  const theTitle = () => {
    if (!content.metadata.title){
      const { model: { id }, onRequestUniqueTitle } = props;
      const title = onRequestUniqueTitle(id);
      title && content.setTitle(title);
    } else {
      return content.metadata.title
    }
  }

  useEffect(() => {
    onRegisterToolApi({
      getTitle: ()=>{
        return theTitle();
      }
    })
  },[])

  const handleDescriptionChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    content.setDescription(event.target.value);
  };

  return (
    <div className="deck-tool">
      <input
        value={theTitle()}
        onChange={e => content.setTitle(e.target.value)}
      />
      <textarea
        value={content.deckDescription}
        onChange={handleDescriptionChange}
        style={{border: "1px solid silver", width: "200px", height: "20px", margin: "10px"}}
      />
    </div>
  );
});
DeckToolComponent.displayName = "DeckToolComponent";

