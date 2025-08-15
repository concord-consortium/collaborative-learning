import { observer } from "mobx-react";
import React, { useEffect } from "react";
import { ITileProps } from "../../components/tiles/tile-component";
import { AIContentModelType } from "./ai-content";

import "./ai-tile.scss";

export const AIComponent: React.FC<ITileProps> = observer((props) => {
  const content = props.model.content as AIContentModelType;

  useEffect(() => {
    async function queryAI() {
      setTimeout(() => {
        content.setText("Dummy AI Output");
      }, 1500);
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
