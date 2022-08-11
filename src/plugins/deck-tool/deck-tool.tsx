import { observer } from "mobx-react";
import React, { useEffect, useState } from "react";
import { connect } from "superagent";
import { IToolTileProps } from "../../components/tools/tool-tile";
import { getTileTitleFromContent } from "../../models/tools/tool-tile";
import { DeckContentModelType } from "./deck-content";

import "./deck-tool.scss";

export const DeckToolComponent: React.FC<IToolTileProps> = observer((props) => {
  //console.log("PROPS: ", props.onRegisterToolApi, props.onRequestUniqueTitle)
  const { documentContent, model: { id}} = props;


  const [localTitle, setLocalTitle] = useState("");
  const content = props.model.content as DeckContentModelType;

  console.log("C: TILE id: ", id)
  console.log("C: COUNT DECKS: ", documentContent?.getElementsByClassName('deck-tool-tile').length)
  console.log("C: metadata.title: ", content.metadata.title)


  useEffect(() => {
    console.log('C: useEffect: __', id)
  })

  useEffect(() => {
    console.log('C: useEffect:[] content.metadata.title - check and set here? ')
    if (!content.metadata.title){
      content.setTitle("BOB")
    }
  }, [])

  // const theTitle = () => {
  //   console.log("theTitle(): ", content.metadata.title)
  //   if (content.metadata.title === undefined){
  //     // this gets triggered over and over when no tiles exist?
  //     const { model: { id }, onRequestUniqueTitle } = props;
  //     console.log(onRequestUniqueTitle)
  //     console.log(id)
  //     const title = onRequestUniqueTitle(id);
  //     console.log(title)
  //     title && content.setTitle(title);
  //   }
  //   return content.metadata.title;
  // }

  // useEffect(() => {
  //   onRegisterToolApi({

  //   })
  // },[content.metadata.title])
  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    content.setTitle(event.target.value);
  };

  return (
    <div className="starter-tool">
      <textarea value={content.metadata.title} onChange={handleChange} />
    </div>
  );


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

  // useEffect(() => {
  //   console.log(content.metadata.title)
  //   onRegisterToolApi({ getTitle: () => theTitle() });
  // }, []);

  // const updateDeckTitle = (event: any) => {
  //   content.setTitle(event);
  // };

  // return (
  //   <div className="deck-tool" style={{ border: "3px dashed silver", padding: "6px" }}>
  //       { content.metadata.title }
  //   </div>
  // );
});
DeckToolComponent.displayName = "DeckToolComponent";

// could be the observer is what's giving me trouble
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
// {
//   "id": "qRJtqxC3oE3sSHV-",
//   "title": "zxc",
//   "content": {
//     "type": "Deck",
//     "deckDescription": "description..."
//   }
// }

// {
//   "id": "4QBFH0wBHafSbW9Z",
//   "title": "Deck 1",
//   "content": {
//     "type": "Deck",
//     "deckDescription": "description..."
//   }
// }

// {
//   "id": "4QBFH0wBHafSbW9Z",
//   "title": "bobo",
//   "content": {
//     "type": "Deck",
//     "deckDescription": "description..."
//   }
// }

// {
//   "id": "qRJtqxC3oE3sSHV-",
//   "title": "bobo",
//   "content": {
//     "type": "Deck",
//     "deckDescription": "description..."
//   }
// }

/*

{
  "id": "Ad-ohSp0zpqvktPE",
  "title": "goo",
  "content": {
    "type": "Deck",
    "deckDescription": "description..."
  }
}


{
  "id": "0aDHVKsMxFcUqFdB",
  "title": "ba",
  "content": {
    "type": "Deck",
    "deckDescription": "description..."
  }
}




*/