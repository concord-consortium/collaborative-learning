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
  LinkTileButton, MergeInButton, ViewInGraphButton } from "./components/data-card-toolbar-buttons";
import { useTileDataMerging } from "../../hooks/use-tile-data-merging";

import "./data-card-toolbar.scss";

interface IProps extends IFloatingToolbarProps {
  currEditAttrId: string;
  currEditFacet: EditFacet;
  isMergeEnabled?: boolean;
  isLinkEnabled?: boolean;
  model: ITileModel;
  handleDeleteValue: () => void;
  handleDuplicateCard: () => void;
  setImageUrlToAdd: (url: string) => void;
  showLinkTileDialog?: () => void;
  showMergeTileDialog?: () => void;
  showGraphLinkDialog?: () => void;
}

export const DataCardToolbar: React.FC<IProps> = observer(function DataCardToolbar({
    isLinkEnabled, model, documentContent, tileElt, currEditAttrId, currEditFacet,
    showLinkTileDialog, showGraphLinkDialog,
    onIsEnabled, setImageUrlToAdd, handleDeleteValue, handleDuplicateCard,
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

  const { isMergeEnabled, showMergeTileDialog } = useTileDataMerging({model});

  const isEditingValue = !!currEditAttrId && currEditFacet === "value";
  const valueActionsEnabled = enabled && isEditingValue;

  const uploadImage = (file: File) => {
    gImageMap.addFileImage(file)
      .then(image => {
        setImageUrlToAdd(image.contentUrl || "");
        (currentCaseId && currEditAttrId && image.contentUrl)
            && content.setAttValue(currentCaseId, currEditAttrId, image.contentUrl);
      });
  };

  const handleLinkButtonCLick = () => {
    showLinkTileDialog && showLinkTileDialog();
  };

  const handleShowInGraphButtonClick = () => {
    showGraphLinkDialog && showGraphLinkDialog();
  };

  const handleMergeDataClick = () => {
    showMergeTileDialog && showMergeTileDialog();
  };

  const toolbarClasses = classNames(
    "data-card-toolbar",
    enabled && location ? "enabled" : "disabled",
  );

  const valueActionsButtonsClasses = classNames(
    "value-actions-buttons",
    { "value-actions-disabled": !valueActionsEnabled }
  );

  const cardActionsButtonsClasses = classNames(
    "card-actions-buttons",
    { "card-actions-disabled": content.attributes.length < 1 }
  );

  return documentContent
    ? ReactDOM.createPortal(
      <div className={toolbarClasses} style={location}>
        <div className={cardActionsButtonsClasses}>
          <DuplicateCardButton onClick={handleDuplicateCard} />
          <LinkTileButton isEnabled={isLinkEnabled} onClick={handleLinkButtonCLick} />
          <MergeInButton onClick={handleMergeDataClick} isEnabled={isMergeEnabled} />
          <ViewInGraphButton onClick={handleShowInGraphButtonClick} isEnabled={true} />
        </div>
        <div className={valueActionsButtonsClasses}>
          <ImageUploadButton onUploadImageFile={file => uploadImage(file)} />
          <DeleteAttrButton onClick={handleDeleteValue} />
        </div>
      </div>, documentContent)
  : null;
});
