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

  return (
    <div className="deck-tool">
      <input
        value={theTitle()}
        onChange={e => content.setTitle(e.target.value)}
      />
    </div>
  );
});
DeckToolComponent.displayName = "DeckToolComponent";

