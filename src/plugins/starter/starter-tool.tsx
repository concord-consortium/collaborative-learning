import { observer } from "mobx-react";
import React from "react";
import { IToolTileProps } from "../../components/tools/tool-tile";
import { StarterContentModelType } from "./starter-content";
import "./starter-tool.scss";

export const StarterToolComponent: React.FC<IToolTileProps> = observer((props) => {
  const content = props.model.content as StarterContentModelType;

  // Should this be a callback
  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    content.setText(event.target.value);
  };

  return (
    <div className="starter-tool">
      <textarea value={ content.text } onChange={handleChange} />
    </div>
  );
});
StarterToolComponent.displayName = "StarterToolComponent";
