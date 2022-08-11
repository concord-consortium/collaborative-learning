import { observer } from "mobx-react";
import React, { useEffect } from "react";
import { IToolTileProps } from "../../components/tools/tool-tile";
import { DeckContentModelType } from "./deck-content";
import { EditableTileTitle } from "../../components/tools/editable-tile-title";
import { measureText } from "../../components/tools/hooks/use-measure-text";
import { defaultTileTitleFont } from "../../components/constants";

import "./deck-tool.scss";

export const DeckToolComponent: React.FC<IToolTileProps> = observer((props) => {
  const { onRegisterToolApi, model, scale, readOnly } = props;

  const content = model.content as DeckContentModelType;

  const theTitle = () => {
    if (!content.metadata.title){
      const { model: { id }, onRequestUniqueTitle } = props;
      const title = onRequestUniqueTitle(id);
      title && content.setTitle(title);
    } else {
      return content.metadata.title
    }
  }

  useEffect(() => {
    onRegisterToolApi({ getTitle: () => theTitle() });
  }, [content.metadata.title]);

  const updateDeckTitle = (event: any) => {
    content.setTitle(event);
  };

  return (
    <div className="deck-tool" style={{ border: "3px dashed silver", padding: "6px" }}>
      <EditableTileTitle
        key="deck-title"
        size={{width: null, height: null}}
        scale={scale}
        getTitle={theTitle}
        readOnly={readOnly}
        measureText={(text) => measureText(text, defaultTileTitleFont)}
        onEndEdit={updateDeckTitle}
      />
    </div>
  );
});
DeckToolComponent.displayName = "DeckToolComponent";

