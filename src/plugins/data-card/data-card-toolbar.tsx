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
import { DeleteAttrIconButton, DuplicateCardIconButton } from "./components/add-remove-icons";
import { EditFacet } from "./data-card-types";

import "./data-card-toolbar.scss";

interface IProps extends IFloatingToolbarProps {
  model: ITileModel;
  currEditAttrId: string;
  currEditFacet: EditFacet;
  setImageUrlToAdd: (url: string) => void;
  handleDeleteValue: () => void;
  handleDuplicateCard: () => void;
}

export const DataCardToolbar: React.FC<IProps> = observer(({
  model, documentContent, tileElt, currEditAttrId, currEditFacet,
  onIsEnabled, setImageUrlToAdd, handleDeleteValue, handleDuplicateCard, ...others
  }: IProps) => {

    const content = model.content as DataCardContentModelType;
    const currentCaseId = content.dataSet.caseIDFromIndex(content.caseIndex);
    const enabled = onIsEnabled(); //"enabled" is the visibility of the toolbar at lower left
    const location = useFloatingToolbarLocation({
      documentContent,
      tileElt,
      toolbarHeight: 34,
      toolbarTopOffset: 2,
      enabled,
       ...others
  });

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
          <DuplicateCardIconButton onClick={handleDuplicateCard} />
        </div>
        <div className={valueActionsButtonsClasses}>
          <ImageUploadButton onUploadImageFile={file => uploadImage(file)} />
          <DeleteAttrIconButton onClick={handleDeleteValue} />
        </div>
      </div>, documentContent)
  : null;
});
