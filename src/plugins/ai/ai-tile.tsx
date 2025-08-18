import { observer } from "mobx-react";
import React, { useEffect, useState } from "react";
import Markdown from "markdown-to-jsx";
import { ITileProps } from "../../components/tiles/tile-component";
import { AIContentModelType } from "./ai-content";
import { useUserContext } from "../../hooks/use-user-context";
import { useStores } from "../../hooks/use-stores";
import { useFirebaseFunction } from "../../hooks/use-firebase-function";

import "./ai-tile.scss";

export const AIComponent: React.FC<ITileProps> = observer((props) => {
  const content = props.model.content as AIContentModelType;
  const getAiContent = useFirebaseFunction("getAiContent_v2");
  const userContext = useUserContext();
  const stores = useStores();
  const [updateRequests, setUpdateRequests] = useState<number>(0);
  const [isUpdating, setIsUpdating] = useState(true);

  useEffect(() => {
    const queryAI = async () => {
      setIsUpdating(true);
      if (!props.documentId || !props.model.id) {
        console.log("No documentId or tileId found");
        return;
      }
      if (!content.prompt) {
        console.log("No prompt found");
        return;
      }
      console.log("Querying AI with prompt", content.prompt);
      const response = await getAiContent({
        context: userContext,
        dynamicContentPrompt: content.prompt,
        unit: stores.unit.code,
        documentId: props.documentId,
        tileId: props.model.id
      });
      content.setText(response.data.text);
      setIsUpdating(false);
    };
    queryAI();
  }, [updateRequests,content, getAiContent, props.documentId, props.model.id, userContext, stores.unit.code]);

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    content.setPrompt(event.target.value);
  };

  const handleUpdateButton = () => {
    setUpdateRequests(updateRequests + 1);
  };

  return (
    <div className="tile-content ai-tool">
      <h3>Prompt for AI</h3>
      <textarea value={content.prompt} onChange={handleChange} disabled={isUpdating} />
      <button onClick={handleUpdateButton} className="update-button" disabled={isUpdating}>Update</button>
      <h3>AI Output</h3>
      <div className="ai-output">
        {isUpdating ? (
          <p>Updating...</p>
        ) : (
          <Markdown>{content.text}</Markdown>
        )}
      </div>
    </div>
  );
});

AIComponent.displayName = "AIComponent";
