import { observer } from "mobx-react";
import React, { useEffect } from "react";
import { IToolTileProps } from "../../components/tools/tool-tile";
import { DeckContentModelType } from "./deck-content";

import "./deck-tool.scss";

export const DeckToolComponent: React.FC<IToolTileProps> = observer((props) => {
  const { onRegisterToolApi, model } = props;

  const content = model.content as DeckContentModelType;

  // const theTitle = () => {
  //   console.log("theTitle(): ", content.metadata.title)
  //   if (!content.metadata.title){
  //     const { model: { id }, onRequestUniqueTitle } = props;
  //     const title = onRequestUniqueTitle(id);
  //     title && content.setTitle(title);
  //   } else {
  //     return content.metadata.title;
  //   }
  // };

  useEffect(() => {
    console.log('effect')
    // onRegisterToolApi({ getTitle: () => theTitle() });
    if (!content.metadata.title){
      const { model: { id }, onRequestUniqueTitle } = props;
      const title = onRequestUniqueTitle(id);
      title && content.setTitle(title);
    }
  }, []);

  const updateDeckTitle = (event: any) => {
    content.setTitle(event);
  };

  return (
    <div className="deck-tool" style={{ border: "3px dashed silver", padding: "6px" }}>
        { content.metadata.title }
    </div>
  );
});
DeckToolComponent.displayName = "DeckToolComponent";

// {
//   "id": "Aexkg0vtFreMQOgK",
//   "title": "Deck 1",
//   "content": {
//     "type": "Deck",
//     "deckDescription": "description..."
//   }
// }

// {
//   "id": "tn3SKQIuJSOGe5hu",
//   "content": {
//     "type": "Deck",
//     "deckDescription": "description..."
//   }
// }