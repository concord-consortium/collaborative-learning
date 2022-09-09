import { observer } from "mobx-react";
import classNames from "classnames";
import React from "react";
import ReactDOM from "react-dom";
import { gImageMap } from "../../models/image-map";
import {
  IFloatingToolbarProps, useFloatingToolbarLocation
} from "../../components/tools/hooks/use-floating-toolbar-location";
import { DataCardContentModelType } from "./data-card-content";
import { ToolTileModelType } from "../../models/tools/tool-tile";
import { ImageUploadButton } from "../../components/tools/image/image-toolbar";
import "./data-card-toolbar.scss";

interface IProps extends IFloatingToolbarProps {
  model: ToolTileModelType;
  currEditAttrId: string;
  setImageUrlToAdd: (url: string) => void;
  handleDeleteValue: () => void;
}

export const DataCardToolbar: React.FC<IProps> = observer(({
  model, documentContent, toolTile, currEditAttrId,
  onIsEnabled, setImageUrlToAdd, handleDeleteValue, ...others
  }: IProps) => {
    const buttonsEnabled = onIsEnabled() && !!currEditAttrId;
    const content = model.content as DataCardContentModelType;
    const currentCaseId = content.dataSet.caseIDFromIndex(content.caseIndex);
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

  const toolbarClasses = classNames(
    "data-card-toolbar",
    enabled && location ? "enabled" : "disabled",
  );

  const toolbarButtonsClasses = classNames(
    "toolbar-buttons",
    buttonsEnabled ? "" : "disabled"
  );

  return documentContent
    ? ReactDOM.createPortal(
      <div className={toolbarClasses} style={location} onMouseDown={e => e.stopPropagation()}>
        <div className={toolbarButtonsClasses} >
          <ImageUploadButton onUploadImageFile={file => uploadImage(file)} />
          <button onClick={handleDeleteValue}>&times;</button>
        </div>
      </div>, documentContent)
  : null;
});
