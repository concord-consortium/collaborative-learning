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

// [ OK ] - modal
export const SelectButton = (props: IToolbarButtonComponentProps) => (
  <ModeToolbarButton
    {...props}
    title="Select"
    buttonType="select"
    Icon={SelectIcon}
  />
);

// [ OK ] - modal
export const LineButton = (props: IToolbarButtonComponentProps) => (
  <ModeToolbarButton
    {...props}
    title="Freehand"
    buttonType="line"
    Icon={FreehandIcon}
  />
);

// [ OK ] - modal
export const RectangleButton = (props: IToolbarButtonComponentProps) => (
  <ModeToolbarButton
    {...props}
    title="Rectangle"
    buttonType="rectangle"
    Icon={RectangleIcon}
  />
);

// [ OK ] - modal
export const EllipseButton = (props: IToolbarButtonComponentProps) => (
  <ModeToolbarButton
    {...props}
    title="Ellipse"
    buttonType="ellipse"
    Icon={EllipseIcon}
  />
);

// [ OK ] - modal
export const TextButton = (props: IToolbarButtonComponentProps) => (
  <ModeToolbarButton
    {...props}
    title="Text"
    buttonType="text"
    Icon={TextIcon}
  />
);

// [ ] VectorButton ("Line" asset name) - has long press
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

// [ ] StampButton - HAS drop down
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

// [ ] StrokeColorButton - IS drop down
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

// [ ] FillColorButton - IS drop down
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

// [ ] ImageUploadButton - use Boris' generic when it's ready
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

// [ OK ] GroupButton - BASIC ACTION
export function GroupButton({ name }: IToolbarButtonComponentProps) {
  const drawingModel = useContext(DrawingContentModelContext);
  function handleClick() {
    if (drawingModel.selection.length > 1) {
      drawingModel.createGroup(drawingModel.selection);
    }
  }

  return (
    <TileToolbarButton name={name} title={"Group"} onClick={handleClick}>
      <GroupObjectsIcon />
    </TileToolbarButton>
  );
}

// [ OK ] UngroupButton - BASIC ACTION
export function UngroupButton({ name }: IToolbarButtonComponentProps) {
  const drawingModel = useContext(DrawingContentModelContext);

  function handleClick() {
    if (drawingModel.selection.length > 0) {
      drawingModel.ungroupGroups(drawingModel.selection);
    }
  }

  return (
    <TileToolbarButton name={name} title={"Ungroup"} onClick={handleClick}>
      <UngroupObjectsIcon />
    </TileToolbarButton>
  );
}

// [ OK ] DuplicateButton - BASIC ACTION
export function DuplicateButton({ name }: IToolbarButtonComponentProps) {
  const drawingModel = useContext(DrawingContentModelContext);

  function handleClick() {
    drawingModel.duplicateObjects(drawingModel.selection);
  }

  return (
    <TileToolbarButton name={name} title={"Duplicate"} onClick={handleClick}>
      <DuplicateIcon />
    </TileToolbarButton>
  );
}

// [ OK ] DeleteButton - BASIC ACTION
export function DeleteButton({ name }: IToolbarButtonComponentProps) {
  const drawingModel = useContext(DrawingContentModelContext);

  const handleClick = () => {
    drawingModel.deleteObjects([...drawingModel.selection]);
  };

  return (
    <TileToolbarButton name={name} title={"Delete"} onClick={handleClick}>
      <DeleteIcon />
    </TileToolbarButton>
  );
}
