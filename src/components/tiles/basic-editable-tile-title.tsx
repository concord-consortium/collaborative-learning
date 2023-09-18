import React from "react";

import { ToolTitleArea } from "./tile-title-area";
import { EditableTileTitle } from "./editable-tile-title";
import { measureText } from "./hooks/use-measure-text";
import { defaultTileTitleFont } from "../constants";
import { ITileModel } from "../../models/tiles/tile-model";

interface IBasicEditableTileTitleProps {
  model: ITileModel;
  readOnly?: boolean;
  scale?: number;
  titleKey?: string;
}
export function BasicEditableTileTitle({ model, readOnly, scale, titleKey }: IBasicEditableTileTitleProps) {
  const getTitle  = () => {
    return model.title || "";
  };
  const handleTitleChange = (title?: string) => {
    title && model.setTitle(title);
  };

  return (
    <ToolTitleArea>
      <EditableTileTitle
        key={titleKey}
        size={{width:null, height:null}}
        scale={scale}
        getTitle={getTitle}
        readOnly={readOnly}
        measureText={(text) => measureText(text, defaultTileTitleFont)}
        onEndEdit={handleTitleChange}
      />
    </ToolTitleArea>
  );
}
