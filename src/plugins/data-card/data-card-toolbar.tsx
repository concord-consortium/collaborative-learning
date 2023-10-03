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
import { DataCardMergeInButton, DeleteAttrButton, DuplicateCardButton,
  IDataCardToolbarButtonContext,
  LinkTileButton } from "./components/data-card-toolbar-buttons";
import { useSettingFromStores } from "../../hooks/use-stores";
import { DataSetViewButton } from "../../components/shared/data-set-view-button";

import "./data-card-toolbar.scss";

type IButtonSetting = string | [string, string];

const defaultButtons: IButtonSetting[] = ["duplicate", "link-tile", "merge-in", ["data-set-view", "Table"],
  "image-upload", "delete-attribute"];
interface IProps extends IFloatingToolbarProps {
  currEditAttrId: string;
  currEditFacet: EditFacet;
  isMergeEnabled?: boolean;
  model: ITileModel;
  setImageUrlToAdd: (url: string) => void;
}

export const DataCardToolbar: React.FC<IProps> = observer(function DataCardToolbar({
    model, documentContent, tileElt, currEditAttrId, currEditFacet,
    onIsEnabled, setImageUrlToAdd,
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
    currEditAttrId
  };

  const getToolbarButton = (toolName: IButtonSetting) => {
    if (typeof toolName === "string") {
      switch (toolName) {
        case "duplicate":
          return <DuplicateCardButton key={toolName} context={context} isDisabled={cardActionsDisabled} />;
        case "link-tile":
          return <LinkTileButton key={toolName} context={context} isDisabled={cardActionsDisabled} />;
        case "merge-in":
          return <DataCardMergeInButton key={toolName} context={context} isDisabled={cardActionsDisabled} />;
        case "image-upload":
          return <ImageUploadButton key={toolName} onUploadImageFile={file => uploadImage(file)}
            extraClasses={valueActionsDisabled ? "disabled" : ""}/>;
        case "delete-attribute":
          return <DeleteAttrButton key={toolName} context={context} isDisabled={valueActionsDisabled} />;
      }
    } else {
      // If `toolName` is an array, the first item is the tool name.
      // The remaining items are parameters to the pass to the tool
      const realToolName = toolName[0];
      switch (realToolName) {
        case "data-set-view":
          return <DataSetViewButton key={toolName.join("_")} args={toolName} />;
      }
    }
  };

  return documentContent
    ? ReactDOM.createPortal(
      <div className={toolbarClasses} style={location}>
        {buttons.map(button => getToolbarButton(button))}
      </div>, documentContent)
  : null;
});
