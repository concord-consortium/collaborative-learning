import { observer } from "mobx-react";
import React from "react";
import { ITileProps } from "../../components/tiles/tile-component";
import { ExpressionContentModelType } from "./expression-content";
import { ToolTitleArea } from "../../components/tiles/tile-title-area";
import { EditableTileTitle } from "../../components/tiles/editable-tile-title";
import { defaultTileTitleFont } from "../../components/constants";
import { measureText } from "../../components/tiles/hooks/use-measure-text";

import "./expression-tile.scss";

export const ExpressionToolComponent: React.FC<ITileProps> = observer((props) => {
  const content = props.model.content as ExpressionContentModelType;

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    content.setText(event.target.value);
  };

  const handleTitleChange = (title: any): void => {
    content.setTitle(title);
  };

  const renderTitle = () => {
    const size = {width: null, height: null};
    const { readOnly, scale } = props;
    return (
      <EditableTileTitle
        key="expression-title"
        size={size}
        scale={scale}
        getTitle={() => content.title}
        readOnly={readOnly}
        measureText={(text) => measureText(text, defaultTileTitleFont)}
        onEndEdit={handleTitleChange}
      />
    );
  };

  return (
    <div className="expression-tool">
      <ToolTitleArea>
        {renderTitle()}
      </ToolTitleArea>
      <textarea value={content.text} onChange={handleChange} />
    </div>
  );
});
ExpressionToolComponent.displayName = "ExpressionToolComponent";
