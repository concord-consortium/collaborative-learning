import React, { useContext } from "react";
import { observer } from "mobx-react";
import { TileToolbarButton } from "../../../components/toolbar/tile-toolbar-button";
import { IToolbarButtonComponentProps } from "../../../components/toolbar/toolbar-button-manager";
import { DrawingContentModelContext } from "../components/drawing-content-context";
import FreehandIcon from "./../assets/freehand-icon.svg";
import SelectIcon from "../../../clue/assets/icons/select-tool.svg";
import RectangleIcon from "./../assets/rectangle-icon.svg";
import EllipseIcon from "./../assets/ellipse-icon.svg";
import TextIcon from "../../../assets/icons/comment/comment.svg";
import { ToolbarModalButton } from "../objects/drawing-object";

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
