import { observer } from "mobx-react";
import React from "react";
import ReactDOM from "react-dom";
import { gImageMap } from "../../models/image-map";
import { IFloatingToolbarProps, useFloatingToolbarLocation }
  from "../../components/tools/hooks/use-floating-toolbar-location";
import { DataCardContentModelType } from "./data-card-content";
import { ToolTileModelType } from "../../models/tools/tool-tile";
import { ImageUploadButton } from "../../components/tools/image/image-toolbar";

import "./data-card-toolbar.scss";

interface IProps extends IFloatingToolbarProps {
  model: ToolTileModelType;
  caseIndex: any;
  currEditAttrId: string;
  setImageUrlToAdd: (url: string) => void;
}

export const DataCardPluginToolBar: React.FC<IProps> = observer((
  { model, documentContent, toolTile, caseIndex, currEditAttrId, onIsEnabled,
      setImageUrlToAdd, ...others }: IProps) => {
    const buttonsEnabled = onIsEnabled() && !!currEditAttrId;
  const content = model.content as DataCardContentModelType;
  const currentCaseId = content.dataSet.caseIDFromIndex(caseIndex);
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
        setImageUrlToAdd(image.contentUrl || "");
        (currentCaseId && currEditAttrId && image.contentUrl)
            && content.setAttValue(currentCaseId, currEditAttrId, image.contentUrl);
      });
  };
  return documentContent
    ? ReactDOM.createPortal(
      <div className={`data-card-plugin-toolbar ${enabled && location ? "enabled" : "disabled"}`}
            style={location} onMouseDown={e => e.stopPropagation()}>
        <div className={`toolbar-buttons ${buttonsEnabled ? "" : "disabled"}`} >
          <ImageUploadButton onUploadImageFile={file => uploadImage(file)} />
        </div>
      </div>, documentContent)
  : null;
});
