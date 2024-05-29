import React from "react";
import { UploadButton } from "../../../components/toolbar/upload-button";
import ImageUploadIcon from "../../../assets/icons/upload-image/upload-image-icon.svg";
import { IToolbarButtonComponentProps } from "../../../components/toolbar/toolbar-button-manager";
import { observer } from "mobx-react";
import { gImageMap } from "../../../models/image-map";
import { useDrawingAreaContext } from "../components/drawing-area-context";

export const ImageUploadButton = observer(function ImageUploadButton({name}: IToolbarButtonComponentProps) {
  const drawingAreaContext = useDrawingAreaContext();
  const setImageUrlToAdd = drawingAreaContext?.setImageUrlToAdd || (() => undefined);

  const onUploadImageFile = (file: File) => {
    gImageMap.addFileImage(file)
    .then(image => {
      setImageUrlToAdd(image.contentUrl || '');
    });
  };

  return (
    <UploadButton
      name={name}
      title="Upload image"
      onUpload={onUploadImageFile}
      accept="image/png, image/jpeg"
      >
      <ImageUploadIcon/>
    </UploadButton>
  );
});
