import { observer } from "mobx-react";
import { getParentOfType } from "mobx-state-tree";
import React, { useEffect, useState } from "react";
import Markdown from "markdown-to-jsx";
import { documentSummarizer } from "../../../shared/ai-summarizer/ai-summarizer";
import { ITileProps } from "../../components/tiles/tile-component";
import { AIContentModelType } from "./ai-content";
import { useUserContext } from "../../hooks/use-user-context";
import { useStores } from "../../hooks/use-stores";
import { useFirebaseFunction } from "../../hooks/use-firebase-function";
import { useReadOnlyContext } from "../../components/document/read-only-context";
import { getDocumentIdentifier } from "../../models/document/document-utils";
import { DocumentContentModel } from "../../models/document/document-content";
import { changeSlashesToUnderscores } from "./ai-utils";

import "./ai-tile.scss";

export const AIComponent: React.FC<ITileProps> = observer((props) => {
  const content = props.model.content as AIContentModelType;
  const userContext = useUserContext();
  const readOnly = useReadOnlyContext();
  const stores = useStores();
  const systemPrompt = stores.appConfig.getSetting("systemPrompt", "ai");
  const getAiContent = userContext.classHash ? useFirebaseFunction("getAiContent_v2") : null;
  const [updateRequests, setUpdateRequests] = useState<number>(0);
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  // note: curriculum documents don't have a documentId property,
  // so we might need to get the curriculum path to use as an id
  const identifier = getDocumentIdentifier(getParentOfType(props.model, DocumentContentModel));

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
        if (!identifier || !props.model.id) {
          console.error("No document identifier or tileId found");
          return;
        }
        if (!content.prompt) {
          console.warn("No prompt found");
          setIsUpdating(false);
          return;
        }

        // Add a summary of the current document to the prompt if possible
        let prompt = content.prompt;
        const document = props.documentId ? stores.documents.getDocument(props.documentId) : undefined;
        const summary = document ? documentSummarizer(document.content, {}) : "";
        if (summary) {
          prompt = `This is a summary of the current document:\n\n${summary}\n\n\n`;
          prompt += `Using this information, respond to the following prompt:\n\n${content.prompt}`;
        }

        const response = await getAiContent({
          context: userContext,
          dynamicContentPrompt: prompt, // TODO: could just be "prompt"
          systemPrompt,
          unit: stores.unit.code,
          documentId: changeSlashesToUnderscores(identifier),
          tileId: props.model.id
        });
        content.setText(response.data.text);
        if (response.data.lastUpdated) {
          const timestamp = response.data.lastUpdated;
          setLastUpdated(new Date(timestamp._seconds*1000));
        }
        if (response.data.error) {
          console.error("Error querying AI", response.data.error);
        }
        setIsUpdating(false);
      };
      queryAI();
    }
  }, [updateRequests, content, getAiContent, identifier, props.model.id, userContext, stores.unit.code, systemPrompt]);

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
        { getAiContent &&
          <button onClick={handleUpdateButton} className="update-button" disabled={isUpdating}>Update</button>
        }
      </div>
    );
  };

  return (
    <div className="tile-content ai-tool">
      {renderPromptForm()}
      <div className="ai-output">
        <div className="last-updated">
          {lastUpdated ? lastUpdated.toLocaleString("en-US", {dateStyle: "long"}) : "..."}
        </div>
        {isUpdating ? (
          <p>Loading...</p>
        ) : (
          <Markdown>{content.text}</Markdown>
        )}
      </div>
    </div>
  );
});

AIComponent.displayName = "AIComponent";
