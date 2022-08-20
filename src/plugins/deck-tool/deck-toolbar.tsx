import { observer } from "mobx-react";
import React from "react";
import ReactDOM from "react-dom";
import { gImageMap } from "../../models/image-map";
import { IFloatingToolbarProps, useFloatingToolbarLocation }
  from "../../components/tools/hooks/use-floating-toolbar-location";
import { ImageUploadButton } from "../../components/tools/image/image-toolbar";

import "./deck-toolbar.scss";

interface IProps extends IFloatingToolbarProps {
  // onUploadImageFile: (file: File) => void;
  activeFacet: null | "name" | "value";
  onSetImageUrl: (url: string) => void;
}

export const DeckToolToolBar: React.FC<IProps> = observer((
              { documentContent, toolTile, activeFacet, onIsEnabled, onSetImageUrl, ...others }: IProps) => {
  // const enabled = onIsEnabled() && activeFacet === "value";
  const enabled = onIsEnabled();
  const location = useFloatingToolbarLocation({
                  documentContent,
                  toolTile,
                  toolbarHeight: 34,
                  toolbarTopOffset: 2,
                  enabled,
                  ...others
                });
  // const tooltipOffset = { x: -19, y: -32 };
  const uploadImage = (file: File) => {
    gImageMap.addFileImage(file)
      .then(image => {
        onSetImageUrl(image.contentUrl || '');
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
