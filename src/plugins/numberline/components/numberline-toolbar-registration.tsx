import React, { useContext } from "react";
import { IToolbarButtonComponentProps, registerTileToolbarButtons }
  from "../../../components/toolbar/toolbar-button-manager";
import { TileToolbarButton } from "../../../components/toolbar/tile-toolbar-button";
import { NumberlineToolbarContext } from "./numberline-toolbar-context";
import SelectIcon from "../assets/numberline-toolbar-select-tool.svg";
import PointIcon from "../assets/numberline-toolbar-point-icon.svg";
import PointOpenIcon from "../assets/numberline-toolbar-point-open-icon.svg";
import ResetIcon from "../assets/numberline-toolbar-reset-icon.svg";
import DeleteIcon from "../assets/numberline-toolbar-delete-icon.svg";
import { ToolbarOption } from "./numberline-tile";


const SelectButton = ({name}: IToolbarButtonComponentProps) => {
  const context = useContext(NumberlineToolbarContext);
  const selected = context?.toolbarOption === ToolbarOption.Selection;

  function handleClick() {
    console.log("select clicked");
    if (context) {
      context.handleCreatePointType(ToolbarOption.Selection);
    }
  }

  return (
    <TileToolbarButton
      name={name}
      title="Select Point"
      onClick={handleClick}
      selected={selected}

    >
      <SelectIcon />
    </TileToolbarButton>
  );
};

const PointButton = ({name}: IToolbarButtonComponentProps) => {

  const context = useContext(NumberlineToolbarContext);
  const selected = context?.toolbarOption === ToolbarOption.Filled;

  function handleClick() {
    if (context) {
      context.handleCreatePointType(ToolbarOption.Filled);
    }
  }

  return (
    <TileToolbarButton
      name={name}
      title="Place Point"
      onClick={handleClick}
      selected={selected}
    >
      <PointIcon/>
    </TileToolbarButton>

  );
};

const PointOpenButton = ({name}: IToolbarButtonComponentProps) => {

  const context = useContext(NumberlineToolbarContext);
  const selected = context?.toolbarOption === ToolbarOption.Open;

  function handleClick() {
    if (context) {
      context.handleCreatePointType(ToolbarOption.Open);
    }
  }

  return (
    <TileToolbarButton
      name={name}
      title="Place Open Point"
      onClick={handleClick}
      selected={selected}
    >
      <PointOpenIcon/>
    </TileToolbarButton>
  );
};


const ResetButton = ({name}: IToolbarButtonComponentProps) => {
  const context = useContext(NumberlineToolbarContext);
  const handleResetPoints = context?.handleResetPoints;

  function handleClick() {
    if (handleResetPoints) {
      handleResetPoints();
    }
  }

  return (
    <TileToolbarButton
      name={name}
      title="Reset"
      onClick={handleClick}
    >
      <ResetIcon/>
    </TileToolbarButton>
  );
};

const DeleteButton = ({name}: IToolbarButtonComponentProps) => {

  const context = useContext(NumberlineToolbarContext);
  const handleDeletePoint = context?.handleDeletePoint;

  function handleClick() {
    if (handleDeletePoint) {
      handleDeletePoint();
    }
  }

  return (
    <TileToolbarButton
      name={name}
      title="Delete Point(s)"
      onClick={handleClick}
    >
      <DeleteIcon/>
    </TileToolbarButton>
  );
};


registerTileToolbarButtons("numberline",
[
  {
    name: "select",
    component: SelectButton
  },
  {
    name: "point",
    component: PointButton
  },
  {
    name: "point-open",
    component: PointOpenButton
  },
  {
    name: "reset",
    component: ResetButton
  },
  {
    name: "delete",
    component: DeleteButton
  }
]);
