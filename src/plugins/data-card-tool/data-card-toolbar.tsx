import { observer } from "mobx-react";
import React from "react";
import ReactDOM from "react-dom";
import { gImageMap } from "../../models/image-map";
import { IFloatingToolbarProps, useFloatingToolbarLocation }
  from "../../components/tools/hooks/use-floating-toolbar-location";
import { ImageUploadButton } from "../../components/tools/image/image-toolbar";

import "./deck-toolbar.scss";
import { DeckContentModelType } from "./deck-content";
import { ToolTileModelType } from "../../models/tools/tool-tile";

interface IProps extends IFloatingToolbarProps {
  model: ToolTileModelType;
  selectedCell: {caseId: string, attrKey: string} | undefined;
  onSetImageUrl: (url: string) => void;
}

export const DeckToolToolBar: React.FC<IProps> = observer((
  { model, documentContent, toolTile, selectedCell, onIsEnabled, onSetImageUrl, ...others }: IProps) => {
  // const enabled = onIsEnabled() && activeFacet === "value";
  const content = model.content as DeckContentModelType;
  const enabled = onIsEnabled();
  const location = useFloatingToolbarLocation({
                  documentContent,
                  toolTile,
                  toolbarHeight: 34,
                  toolbarTopOffset: 2,
                  enabled,
                  ...others
                });
  const uploadImage = (file: File) => {
    gImageMap.addFileImage(file)
      .then(image => {
        onSetImageUrl(image.contentUrl || "");
        (selectedCell && image.contentUrl)
            && content.setAttValue(selectedCell.caseId, selectedCell.attrKey, image.contentUrl);
      });
  };
  return documentContent
    ? ReactDOM.createPortal(
      <div className={`deck-tool-toolbar ${enabled && location ? "enabled" : "disabled"}`}
            style={location} onMouseDown={e => e.stopPropagation()}>
        <div className="toolbar-buttons">
          <ImageUploadButton onUploadImageFile={file => uploadImage(file)} />
        </div>
      </div>, documentContent)
  : null;
});
