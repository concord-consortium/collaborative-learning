import Markdown from "markdown-to-jsx";
import { observer } from "mobx-react";
import { getParentOfType, getSnapshot } from "mobx-state-tree";
import React, { useEffect, useRef, useState } from "react";
import { documentHasStudentWork } from "../../../shared/ai-analysis-classify";
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
import { AI_TILE_EMPTY_MESSAGE } from "../../models/document/ai-evaluation-messages";
import { AIContentModelType, logAiEvent } from "./ai-content";
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
  // Guards against overlapping refresh requests: each run's generation, checked after its await,
  // tells a superseded request not to touch text or isUpdating.
  const requestGenerationRef = useRef(0);
  // Text to restore when a request is invalidated with no successor to finish the job (e.g. the
  // class context disappears mid-request). Shared across runs, and cleared once no longer needed.
  const previousTextRef = useRef<string | undefined>(undefined);

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
    // A read-only rendering hides the only UI that could trigger this request, so the sole way this effect
    // would otherwise fire is simply mounting, making every request in that context a waste.
    if (readOnly) return;

    const generation = ++requestGenerationRef.current;
    const isCurrent = () => requestGenerationRef.current === generation;
    // Undo a superseded run's own blanking before anything else runs, so this run starts from real
    // text — otherwise this run's own capture below would save the blank, not the good text.
    if (previousTextRef.current !== undefined) {
      content.setText(previousTextRef.current);
      previousTextRef.current = undefined;
      if (!getAiContent) setIsUpdating(false);
    }
    if (getAiContent) {
      const queryAI = async () => {
        setIsUpdating(true);
        try {
          if (!identifier || !model.id) {
            console.error("No document identifier or tileId found");
            return;
          }
          if (!content.prompt) {
            console.warn("No prompt found");
            return;
          }

          const document = documentId
            ? documents.getDocument(documentId) ?? networkDocuments.getDocument(documentId)
            : undefined;

          // No student document at all — e.g. an authored curriculum section shown in the problem
          // panel, which has no documentId. Make no request and leave the text alone.
          if (!document?.content) {
            return;
          }
          // A student document with no work in it: nudge, and make no request.
          if (!documentHasStudentWork(getSnapshot(document.content))) {
            content.setText(AI_TILE_EMPTY_MESSAGE);
            return;
          }

          previousTextRef.current = content.text;
          content.setText("");
          const summary = documentSummarizer(document.content, {});
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
          // A newer refresh has taken over; leave its result and isUpdating alone.
          if (!isCurrent()) return;
          // getAiContent resolves (not rejects) on a server-side failure, with a truthy error and
          // empty text. Thrown here to route it through the same catch as a rejection.
          if (response.data.error) {
            throw new Error(response.data.error);
          }
          content.setText(response.data.text);
          previousTextRef.current = undefined;
          if (response.data.lastUpdated) {
            const timestamp = response.data.lastUpdated;
            setLastUpdated(new Date(timestamp._seconds*1000));
          }
        } catch (error) {
          // Restore rather than leave the blank text set above; no-op if nothing was cleared, or a
          // newer refresh has taken over.
          if (isCurrent() && previousTextRef.current !== undefined) {
            content.setText(previousTextRef.current);
            previousTextRef.current = undefined;
          }
          console.error("Failed to query AI", error);
        } finally {
          if (isCurrent()) setIsUpdating(false);
        }
      };
      queryAI();
    }
  }, [
    content.refreshCount, content, documentId, documents, getAiContent, identifier, model.id, networkDocuments,
    readOnly, userContext, unit.code, systemPrompt
  ]);

  // Track the prompt's value at focus time so we can log once on blur, and only when it changed —
  // mirroring the text tile's handleBlur convention rather than logging on every keystroke. The
  // description is authoring text ("shown to students"), not student answer work, so it is not logged.
  const promptOnFocus = useRef("");

  const handlePromptChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    content.setPrompt(event.target.value);
  };

  const handlePromptBlur = () => {
    if (content.prompt !== promptOnFocus.current) {
      logAiEvent(content, "setPrompt", { prompt: content.prompt });
    }
  };

  const handleDescriptionChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    content.setDescription(event.target.value);
  };

  const renderPromptForm = () => {
    if (readOnly || content.hidePrompt) return null;
    return (
      <div className="prompt-form">
        <h3>Prompt for AI</h3>
        <textarea
          value={content.prompt}
          onChange={handlePromptChange}
          onFocus={() => { promptOnFocus.current = content.prompt; }}
          onBlur={handlePromptBlur}
          disabled={isUpdating}
        />
        <button
          onClick={() => content.requestRefresh()}
          className="update-button"
          disabled={isUpdating}
        >
          Update
        </button>
      </div>
    );
  };

  const renderDescription = () => {
    if (!readOnly && !content.hidePrompt) {
      return (
        <div className="ai-description editing">
          <label htmlFor="ai-description-input">Description (shown to students)</label>
          <textarea
            id="ai-description-input"
            value={content.description}
            onChange={handleDescriptionChange}
          />
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
      <TileToolbar tileType="ai" readOnly={readOnly} tileElement={tileElt} />
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
