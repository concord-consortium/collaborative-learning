import React, { useContext } from "react";
import { TileToolbarButton } from "../../components/toolbar/tile-toolbar-button";
import { IToolbarButtonComponentProps } from "../../components/toolbar/toolbar-button-manager";
import FreehandIcon from "./assets/freehand-icon.svg";
import SelectIcon from "../../clue/assets/icons/select-tool.svg";
import LineIcon from "./assets/line-icon.svg";
import RectangleIcon from "./assets/rectangle-icon.svg";
import EllipseIcon from "./assets/ellipse-icon.svg";
import StrokeColorIcon from "./assets/color-stroke-icon.svg";
import FillColorIcon from "./assets/color-fill-icon.svg";
import DeleteIcon from "../../assets/icons/delete/delete-selection-icon.svg";
import GroupObjectsIcon from "./assets/group-objects-icon.svg";
import UngroupObjectsIcon from "./assets/ungroup-objects-icon.svg";
import DuplicateIcon from "./assets/duplicate-icon.svg";
import ImageUploadIcon from "../../assets/icons/upload-image/upload-image-icon.svg";
import TextIcon from "../../assets/icons/comment/comment.svg";
import { DrawingContentModelContext } from "./components/drawing-content-context";
import { observer } from "mobx-react";

import "./drawing-toolbar.scss";
import { ToolbarModalButton } from "./objects/drawing-object";

interface IModeToolbarButtonProps extends IToolbarButtonComponentProps {
  title: string;
  buttonType: ToolbarModalButton;
  Icon: React.ElementType;
}

const ModeToolbarButton = observer(({ name, title, buttonType, Icon }: IModeToolbarButtonProps) => {
  const drawingModel = useContext(DrawingContentModelContext);
  const selected = drawingModel?.selectedButton === buttonType;

  function handleClick() {
    drawingModel?.setSelectedButton(buttonType);
  }

  return (
    <TileToolbarButton name={name} title={title} selected={selected} onClick={handleClick}>
      <Icon />
    </TileToolbarButton>
  );
});

export const SelectButton = (props: IToolbarButtonComponentProps) => (
  <ModeToolbarButton
    {...props}
    title="Select"
    buttonType="select"
    Icon={SelectIcon}
  />
);

export const LineButton = (props: IToolbarButtonComponentProps) => (
  <ModeToolbarButton
    {...props}
    title="Freehand"
    buttonType="line"
    Icon={FreehandIcon}
  />
);

export const RectangleButton = (props: IToolbarButtonComponentProps) => (
  <ModeToolbarButton
    {...props}
    title="Rectangle"
    buttonType="rectangle"
    Icon={RectangleIcon}
  />
);

export const EllipseButton = (props: IToolbarButtonComponentProps) => (
  <ModeToolbarButton
    {...props}
    title="Ellipse"
    buttonType="ellipse"
    Icon={EllipseIcon}
  />
);

export const TextButton = (props: IToolbarButtonComponentProps) => (
  <ModeToolbarButton
    {...props}
    title="Text"
    buttonType="text"
    Icon={TextIcon}
  />
);

// VectorButton ("Line" asset name)
export function VectorButton({ name }: IToolbarButtonComponentProps) {
  const selected = false;
  const title = "Vector";

  function handleClick() {
    console.log("handleClick: " + name);
  }

  return (
    <TileToolbarButton name={name} title={title} selected={selected} onClick={handleClick}>
      <LineIcon />
    </TileToolbarButton>
  );
}

// StampButton
export function StampButton({ name }: IToolbarButtonComponentProps) {
  const selected = false;
  const title = "Stamp";

  function handleClick() {
    console.log("handleClick: " + name);
  }

  return (
    <TileToolbarButton name={name} title={title} selected={selected} onClick={handleClick}>
      <EllipseIcon />
    </TileToolbarButton>
  );
}

// StrokeColorButton
export function StrokeColorButton({ name }: IToolbarButtonComponentProps) {
  const selected = false;
  const title = "Stroke Color";

  function handleClick() {
    console.log("handleClick: " + name);
  }

  return (
    <TileToolbarButton name={name} title={title} selected={selected} onClick={handleClick}>
      <StrokeColorIcon />
    </TileToolbarButton>
  );
}

// FillColorButton
export function FillColorButton({ name }: IToolbarButtonComponentProps) {
  const selected = false;
  const title = "Fill Color";

  function handleClick() {
    console.log("handleClick: " + name);
  }

  return (
    <TileToolbarButton name={name} title={title} selected={selected} onClick={handleClick}>
      <FillColorIcon />
    </TileToolbarButton>
  );
}

// ImageUploadButton
export function ImageUploadButton({ name }: IToolbarButtonComponentProps) {
  const selected = false;
  const title = "Image Upload";

  function handleClick() {
    console.log("handleClick: " + name);
  }

  return (
    <TileToolbarButton name={name} title={title} selected={selected} onClick={handleClick}>
      <ImageUploadIcon />
    </TileToolbarButton>
  );
}

// GroupButton
export function GroupButton({ name }: IToolbarButtonComponentProps) {
  const selected = false;
  const title = "Group";

  function handleClick() {
    console.log("handleClick: " + name);
  }

  return (
    <TileToolbarButton name={name} title={title} selected={selected} onClick={handleClick}>
      <GroupObjectsIcon />
    </TileToolbarButton>
  );
}

// UngroupButton
export function UngroupButton({ name }: IToolbarButtonComponentProps) {
  const selected = false;
  const title = "Ungroup";

  function handleClick() {
    console.log("handleClick: " + name);
  }

  return (
    <TileToolbarButton name={name} title={title} selected={selected} onClick={handleClick}>
      <UngroupObjectsIcon />
    </TileToolbarButton>
  );
}

// DuplicateButton
export function DuplicateButton({ name }: IToolbarButtonComponentProps) {
  const selected = false;
  const title = "Duplicate";

  function handleClick() {
    console.log("handleClick: " + name);
  }

  return (
    <TileToolbarButton name={name} title={title} selected={selected} onClick={handleClick}>
      <DuplicateIcon />
    </TileToolbarButton>
  );
}

// DeleteButton
export function DeleteButton({ name }: IToolbarButtonComponentProps) {
  const selected = false;
  const title = "Delete";

  function handleClick() {
    console.log("handleClick: " + name);
  }

  return (
    <TileToolbarButton name={name} title={title} selected={selected} onClick={handleClick}>
      <DeleteIcon />
    </TileToolbarButton>
  );
}
