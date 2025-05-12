import React, { useContext } from "react";
import { observer } from "mobx-react";
import { TileToolbarButton } from "../../../components/toolbar/tile-toolbar-button";
import { IToolbarButtonComponentProps } from "../../../components/toolbar/toolbar-button-manager";
import { DrawingContentModelContext } from "../components/drawing-content-context";
import { ToolbarModalButton } from "../objects/drawing-object";
import { ToolbarButtonSvg } from "./toolbar-button-svg";
import FreehandIcon from "./../assets/freehand-icon.svg";
import SelectIcon from "../../../clue/assets/icons/select-tool.svg";
import RectangleIcon from "./../assets/rectangle-icon.svg";
import EllipseIcon from "./../assets/ellipse-icon.svg";
import TextIcon from "../../../assets/icons/comment/comment.svg";
import { OpenPaletteValues } from "../model/drawing-content";

interface IModeButtonProps extends IToolbarButtonComponentProps {
  title: string;
  buttonType: ToolbarModalButton;
  Icon: React.ElementType;
}

//
function getSvgPropertiesForType(type: ToolbarModalButton, drawingModel: any) {
  switch (type) {
    case "text":
      return {
        fill: drawingModel.stroke
      };
    case "line":
    case "rectangle":
    case "ellipse":
      return {
        fill: drawingModel.fill,
        stroke: drawingModel.stroke
      };
    default:
      return {
        fill: "black",
        stroke: "black"
      };
  }
}

const ModeButton = observer(({ name, title, buttonType, Icon }: IModeButtonProps) => {
  const drawingModel = useContext(DrawingContentModelContext);
  const selected = drawingModel?.selectedButton === buttonType;
  const SvgIconComponent = Icon as React.FC<React.SVGProps<SVGSVGElement>>;
  const settings = getSvgPropertiesForType(buttonType, drawingModel);

  function handleClick() {
    drawingModel.setOpenPalette(OpenPaletteValues.None);
    drawingModel?.setSelectedButton(buttonType);
  }

  return (
    <TileToolbarButton name={name} title={title} selected={selected} onClick={handleClick}>
      <ToolbarButtonSvg
        SvgIcon={SvgIconComponent}
        settings={settings}
      />
    </TileToolbarButton>
  );
});

export const RectangleButton: React.FC<IToolbarButtonComponentProps> = ({name}) => {
  return (
    <ModeButton
      name={name}
      title="Rectangle"
      buttonType="rectangle"
      Icon={RectangleIcon}
    />
  );
};

export const SelectButton: React.FC<IToolbarButtonComponentProps> = ({name}) => {
  return (
    <ModeButton
      name={name}
      title="Select"
      buttonType="select"
      Icon={SelectIcon}
    />
  );
};

export const LineButton: React.FC<IToolbarButtonComponentProps> = ({name}) => {
  return (
    <ModeButton
      name={name}
      title="Freehand"
      buttonType="line"
      Icon={FreehandIcon}
    />
  );
};

export const EllipseButton: React.FC<IToolbarButtonComponentProps> = ({name}) => {
  return (
    <ModeButton
      name={name}
      title="Ellipse"
      buttonType="ellipse"
      Icon={EllipseIcon}
    />
  );
};

export const TextButton: React.FC<IToolbarButtonComponentProps> = ({name}) => {
  return (
    <ModeButton
      name={name}
      title="Text"
      buttonType="text"
      Icon={TextIcon}
    />
  );
};
