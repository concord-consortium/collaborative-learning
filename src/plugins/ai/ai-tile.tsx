import Markdown from "markdown-to-jsx";
import { observer } from "mobx-react";
import { getParentOfType } from "mobx-state-tree";
import React, { useEffect, useState } from "react";
import { documentSummarizer } from "../../../shared/ai-summarizer/ai-summarizer";
import { useReadOnlyContext } from "../../components/document/read-only-context";
import { BasicEditableTileTitle } from "../../components/tiles/basic-editable-tile-title";
import { TileToolbar } from "../../components/toolbar/tile-toolbar";
import { ITileProps } from "../../components/tiles/tile-component";
import { useFirebaseFunction } from "../../hooks/use-firebase-function";
import { useStores } from "../../hooks/use-stores";
import { useUserContext } from "../../hooks/use-user-context";
import { DocumentContentModel } from "../../models/document/document-content";
import { getDocumentIdentifier } from "../../models/document/document-utils";
import { AIContentModelType } from "./ai-content";
import { changeSlashesToUnderscores } from "./ai-utils";

import "./ai-tile.scss";

export const AIComponent: React.FC<ITileProps> = observer((props) => {
  const { documentId, model, tileElt, onRegisterTileApi } = props;
  const content = model.content as AIContentModelType;
  const userContext = useUserContext();
  const readOnly = useReadOnlyContext();
  const stores = useStores();
  const { appConfig, documents, networkDocuments, unit } = stores;
  const systemPrompt = appConfig.getSetting("systemPrompt", "ai");
  const getAiContent = userContext.classHash ? useFirebaseFunction("getAiContent_v2") : null;
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const identifier = getDocumentIdentifier(getParentOfType(model, DocumentContentModel));

  useEffect(() => {
    onRegisterTileApi({
      exportContentAsTileJson: () => {
        return content.exportJson();
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update the AI response
  // TODO: This triggers multiple undoable actions, but shouldn't really trigger any
  useEffect(() => {
    if (getAiContent) {
      const queryAI = async () => {
        setIsUpdating(true);
        if (!identifier || !model.id) {
          console.error("No document identifier or tileId found");
          return;
        }
        if (!content.prompt) {
          console.warn("No prompt found");
          setIsUpdating(false);
          return;
        }

        const document = documentId
          ? documents.getDocument(documentId) ?? networkDocuments.getDocument(documentId)
          : undefined;
        content.setText("");
        const summary = document ? documentSummarizer(document.content, {}) : "";
        let dynamicContentPrompt = summary
          ? `This is a summary of the current document:\n\n${summary}\n\n\n`
          : `No information about the current document could be found.\n\n\n`;
        dynamicContentPrompt += `Using this information, respond to the following prompt:\n\n${content.prompt}`;

        const response = await getAiContent({
          context: userContext,
          dynamicContentPrompt,
          systemPrompt,
          unit: unit.code,
          documentId: changeSlashesToUnderscores(identifier),
          tileId: model.id
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
  }, [
    content.refreshCount, content, documentId, documents, getAiContent, identifier, model.id, networkDocuments,
    userContext, unit.code, systemPrompt
  ]);

  const handlePromptChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    content.setPrompt(event.target.value);
  };

  const handleDescriptionChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    content.setDescription(event.target.value);
  };

  const renderPromptForm = () => {
    if (readOnly || content.hidePrompt) return null;
    return (
      <div className="prompt-form">
        <h3>Prompt for AI</h3>
        <textarea value={content.prompt} onChange={handlePromptChange} disabled={isUpdating} />
      </div>
    );
  };

  const renderDescription = () => {
    if (!readOnly && !content.hidePrompt) {
      // Author view: editable description
      return (
        <div className="ai-description editing">
          <label>Description (shown to students)</label>
          <textarea value={content.description} onChange={handleDescriptionChange} />
        </div>
      );
    }
    // Student/read-only view: show description as static text
    if (!content.description) return null;
    return (
      <div className="ai-description">
        {content.description}
      </div>
    );
  };

  return (
    <div className="tile-content ai-tool">
      <TileToolbar tileType="AI" readOnly={readOnly} tileElement={tileElt} />
      <BasicEditableTileTitle />
      <div className="ai-scrollable-content">
        {renderPromptForm()}
        {renderDescription()}
        <div className="ai-output focusable">
          <div className="last-updated">
            {lastUpdated ? lastUpdated.toLocaleString("en-US", {dateStyle: "long", timeStyle: "short"}) : "..."}
          </div>
          {isUpdating ? (
            <p>Loading...</p>
          ) : (
            <Markdown>{content.text}</Markdown>
          )}
        </div>
      </div>
    </div>
  );
});

AIComponent.displayName = "AIComponent";
