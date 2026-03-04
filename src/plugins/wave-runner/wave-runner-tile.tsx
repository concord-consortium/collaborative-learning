import { observer } from "mobx-react";
import React from "react";
import { BasicEditableTileTitle } from "../../components/tiles/basic-editable-tile-title";
import { ITileProps } from "../../components/tiles/tile-component";
import { WaveRunnerContentModelType } from "./wave-runner-content";
import "./wave-runner.scss";

export const WaveRunnerToolComponent: React.FC<ITileProps> = observer((props) => {
  const content = props.model.content as WaveRunnerContentModelType;

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    content.setText(event.target.value);
  };

  return (
    <div className="tile-content wave-runner-tool">
      <BasicEditableTileTitle />
      <textarea value={content.text} onChange={handleChange} />
    </div>
  );
});
WaveRunnerToolComponent.displayName = "WaveRunnerToolComponent";
