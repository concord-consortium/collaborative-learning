import { observer } from "mobx-react";
import classNames from "classnames";
import React from "react";
import ReactDOM from "react-dom";

import { gImageMap } from "../../models/image-map";
import {
  IFloatingToolbarProps, useFloatingToolbarLocation
} from "../../components/tiles/hooks/use-floating-toolbar-location";
import { DataCardContentModelType } from "./data-card-content";
import { ITileModel } from "../../models/tiles/tile-model";
import { ImageUploadButton } from "../../components/tiles/image/image-toolbar";
import { EditFacet } from "./data-card-types";
import { DeleteAttrButton, DuplicateCardButton,
  IDataCardToolbarButtonContext,
  LinkTileButton, MergeInButton } from "./components/data-card-toolbar-buttons";
import { ITileProps } from "../../components/tiles/tile-component";
import { useSettingFromStores } from "../../hooks/use-stores";

import "./data-card-toolbar.scss";

type IButtonSetting = string | [string, string];

const defaultButtons = ["duplicate", "link-tile", "merge-in", "image-upload", "delete-attribute"];
interface IProps extends IFloatingToolbarProps {
  currEditAttrId: string;
  currEditFacet: EditFacet;
  isMergeEnabled?: boolean;
  model: ITileModel;
  setImageUrlToAdd: (url: string) => void;
  onRequestTilesOfType: ITileProps['onRequestTilesOfType'];
  onRequestLinkableTiles?: ITileProps['onRequestLinkableTiles'];
  documentId?: string;
}

export const DataCardToolbar: React.FC<IProps> = observer(function DataCardToolbar({
    model, documentContent, tileElt, currEditAttrId, currEditFacet,
    onIsEnabled, setImageUrlToAdd, documentId, onRequestTilesOfType, onRequestLinkableTiles,
    ...others }: IProps) {
  const content = model.content as DataCardContentModelType;
  const { caseIndex, dataSet, totalCases } = content;
  const currentCaseId = caseIndex >= 0 && caseIndex < totalCases ? dataSet.caseIDFromIndex(caseIndex) : undefined ;
  const enabled = onIsEnabled(); //"enabled" is the visibility of the toolbar at lower left
  const location = useFloatingToolbarLocation({
    documentContent,
    tileElt,
    toolbarHeight: 34,
    toolbarTopOffset: 2,
    enabled,
      ...others
  });

  const buttonSettings = useSettingFromStores("tools", "datacard") as unknown as IButtonSetting[] | undefined;
  const buttons = buttonSettings || defaultButtons;

  const isEditingValue = !!currEditAttrId && currEditFacet === "value";

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

  const valueActionsDisabled = !enabled || !isEditingValue;
  const cardActionsDisabled = content.attributes.length < 1;

  const context: IDataCardToolbarButtonContext = {
    currEditAttrId,
    documentId,
    onRequestTilesOfType,
    onRequestLinkableTiles
  };

  const getToolbarButton = (toolName: IButtonSetting) => {
    switch (toolName) {
      case "duplicate":
        return <DuplicateCardButton content={content} context={context} isDisabled={cardActionsDisabled} />;
      case "link-tile":
        return <LinkTileButton content={content} context={context} isDisabled={cardActionsDisabled} />;
      case "merge-in":
        return <MergeInButton content={content} context={context} isDisabled={cardActionsDisabled} />;
      case "image-upload":
        // need to disable this button when the valueActions are disabled,
        // the button doesn't have disabled property
        return <ImageUploadButton onUploadImageFile={file => uploadImage(file)}
          extraClasses={valueActionsDisabled ? "disabled" : ""}/>;
      case "delete-attribute":
        return <DeleteAttrButton content={content} context={context} isDisabled={valueActionsDisabled} />;
    }
  };

  return documentContent
    ? ReactDOM.createPortal(
      <div className={toolbarClasses} style={location}>
        {buttons.map(button => getToolbarButton(button))}
      </div>, documentContent)
  : null;
});
