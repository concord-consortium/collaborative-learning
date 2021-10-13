import { observer } from "mobx-react";
import React from "react";
import { IToolTileProps } from "./tool-tile";
import { PluginContentModelType } from "../../models/tools/plugin/plugin-content";

import "./plugin-tool.sass";

type IProps = IToolTileProps;

const PluginToolComponent: React.FC<IProps> = observer((props) => {
  const content = props.model.content as PluginContentModelType;

  // Should this be a callback
  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    content.setText(event.target.value);
  };

  return (
    <div className="plugin-tool">
      <textarea value={ content.text } onChange={handleChange} />
    </div>
  );
});

(PluginToolComponent as any).tileHandlesSelection = true;
export default PluginToolComponent;
