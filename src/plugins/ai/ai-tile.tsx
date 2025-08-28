import { observer } from "mobx-react";
import React, { useEffect, useState } from "react";
import Markdown from "markdown-to-jsx";
import { ITileProps } from "../../components/tiles/tile-component";
import { AIContentModelType } from "./ai-content";
import { useUserContext } from "../../hooks/use-user-context";
import { useStores } from "../../hooks/use-stores";
import { useFirebaseFunction } from "../../hooks/use-firebase-function";
import { useReadOnlyContext } from "../../components/document/read-only-context";

import "./ai-tile.scss";

export const AIComponent: React.FC<ITileProps> = observer((props) => {
  const content = props.model.content as AIContentModelType;
  const userContext = useUserContext();
  const readOnly = useReadOnlyContext();
  const stores = useStores();
  const getAiContent = userContext.classHash ? useFirebaseFunction("getAiContent_v2") : null;
  const [updateRequests, setUpdateRequests] = useState<number>(0);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    props.onRegisterTileApi({
      exportContentAsTileJson: () => {
        return content.exportJson();
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // don't attempt to query AI if there is no class hash (i.e. we're in authoring mode)
    if (getAiContent) {
      const queryAI = async () => {
        setIsUpdating(true);
        if (!props.documentId || !props.model.id) {
          console.log("No documentId or tileId found");
          return;
        }
        if (!content.prompt) {
          console.log("No prompt found");
          setIsUpdating(false);
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
        if (response.data.error) {
          console.error("Error querying AI", response.data.error);
        }
        setIsUpdating(false);
      };
      queryAI();
    }
  }, [updateRequests, content, getAiContent, props.documentId, props.model.id, userContext, stores.unit.code]);

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    content.setPrompt(event.target.value);
  };

  const handleUpdateButton = () => {
    setUpdateRequests(updateRequests + 1);
  };

  const renderPromptForm = () => {
    if (readOnly) {
      return null;
    }
    return (
      <div className="prompt-form">
        <h3>Prompt for AI</h3>
        <textarea value={content.prompt} onChange={handleChange} disabled={isUpdating} />
        <button onClick={handleUpdateButton} className="update-button" disabled={isUpdating}>Update</button>
      </div>
    );
  };

  return (
    <div className="tile-content ai-tool">
      {renderPromptForm()}
      <div className="ai-output">
        <h3>AI Output</h3>
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
