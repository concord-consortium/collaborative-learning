import { observer } from "mobx-react";
import React, { useEffect } from "react";
import { ITileProps } from "../../components/tiles/tile-component";
import { AIContentModelType } from "./ai-content";
import { useUserContext } from "../../hooks/use-user-context";
import { useStores } from "../../hooks/use-stores";
import { useFirebaseFunction } from "../../hooks/use-firebase-function";

import "./ai-tile.scss";

export const AIComponent: React.FC<ITileProps> = observer((props) => {
  const content = props.model.content as AIContentModelType;
  const getCustomizedExemplar = useFirebaseFunction("getCustomizedExemplar_v2");
  const userContext = useUserContext();
  const stores = useStores();

  useEffect(() => {
    const queryAI = async () => {
      if (!props.documentId || !props.model.id) {
        console.log("No documentId or tileId found");
        return;
      }
      console.log("Querying AI");
      let response;
      response = await getCustomizedExemplar({
        context: userContext,
        dynamicContentPrompt: content.prompt,
        unit: stores.unit.code,
        documentId: props.documentId,
        tileId: props.model.id
      });
      console.log("Response from getCustomizedExemplar", response);
      content.setText(response.data.text);
    }
    queryAI();
  }, [content]);

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    content.setPrompt(event.target.value);
  };

  return (
    <div className="tile-content ai-tool">
      <h3>Prompt for AI</h3>
      <textarea value={content.prompt} onChange={handleChange} />
      <h3>AI Output</h3>
      <div className="ai-output">
        <p>{content.text}</p>
      </div>
    </div>
  );
});

AIComponent.displayName = "AIComponent";
