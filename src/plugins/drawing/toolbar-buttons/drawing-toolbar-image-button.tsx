import React from "react";
import { TileToolbarButton } from "../../../components/toolbar/tile-toolbar-button";
import { IToolbarButtonComponentProps } from "../../../components/toolbar/toolbar-button-manager";
import ImageUploadIcon from "../../../assets/icons/upload-image/upload-image-icon.svg";

export function ImageUploadButton({ name }: IToolbarButtonComponentProps) {
  return (
    <TileToolbarButton name={name} title={"Image Upload"} onClick={() => alert("replace me w/ generic")}>
      <ImageUploadIcon />
    </TileToolbarButton>
  );
}

