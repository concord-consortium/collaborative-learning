import { observer } from "mobx-react";
import React from "react";
import { IToolTileProps } from "../../components/tools/tool-tile";
import { DeckContentModelType } from "./deck-content";
import { EditableTileTitle } from "../../components/tools/editable-tile-title";
import { measureText } from "../../components/tools/hooks/use-measure-text";
import { defaultTileTitleFont } from "../../components/constants";
import { ToolTitleArea } from "../../components/tools/tool-title-area";

import "./deck-tool.scss";

export const DeckToolComponent: React.FC<IToolTileProps> = observer((props) => {
  const { readOnly, scale } = props;
  // Note: capturing the content here and using it in handleChange() below may run the risk
  // of encountering a stale closure issue depending on the order in which content changes,
  // component renders, and calls to handleChange() occur. See the PR discussion at
  // (https://github.com/concord-consortium/collaborative-learning/pull/1222/files#r824873678
  // and following comments) for details. We should be on the lookout for such issues.
  const content = props.model.content as DeckContentModelType;

  // const handleDefaultTextAreaChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
  //   content.setDescription(event.target.value);
  // };

  const getDeckTitle = () => {
    return content.title;
  };

  const updateDeckTitle = (event: any) => {
    content.setTitle(event);
  };

  return (
    <div className="deck-tool">
      <ToolTitleArea>
        <EditableTileTitle
          key="deck-title"
          size={{width: null, height: null}}
          scale={scale}
          getTitle={getDeckTitle}
          readOnly={readOnly}
          measureText={(text) => measureText(text, defaultTileTitleFont)}
          onEndEdit={updateDeckTitle}
        />
      </ToolTitleArea>
      {/* <textarea value={content.deckDescription} onChange={handleDefaultTextAreaChange} /> */}
    </div>
  );
});
DeckToolComponent.displayName = "DeckToolComponent";
