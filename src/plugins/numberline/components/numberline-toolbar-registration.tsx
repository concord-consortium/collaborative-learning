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


const SelectButton = ({name}: IToolbarButtonComponentProps) => {

  function handleClick() {
    console.log("select clicked");
  }

  return (
    <TileToolbarButton
      name={name}
      title="Select Point"
      onClick={handleClick}
    >
      <SelectIcon />
    </TileToolbarButton>
  );
};

const PointButton = ({name}: IToolbarButtonComponentProps) => {

  const context = useContext(NumberlineToolbarContext);
  const selected = !context?.pointTypeIsOpen;

  function handleClick() {
    if (context) {
      context.handleCreatePointType(false);
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
  const selected = context?.pointTypeIsOpen;

  function handleClick() {
    if (context) {
      context.handleCreatePointType(true);
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


// export interface INumberlineToolbarContext {
//   handleClearPoints: () => void;
//   handleDeletePoint: () => void;
//   handleCreatePointType: (isOpen: boolean) => void;
//   pointTypeIsOpen: boolean;
// }

const ResetButton = ({name}: IToolbarButtonComponentProps) => {

  const context = useContext(NumberlineToolbarContext);
  const handleClearPoints = context?.handleClearPoints;

  function handleClick() {
    if (handleClearPoints) {
      handleClearPoints();
    }
  }

  return (
    <TileToolbarButton
      name={name}
      title="Reset"
      onClick={handleClick}
      // selected={selected}
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
      // selected={selected}
    >
      <DeleteIcon/>
    </TileToolbarButton>
  );
};




// export const ResetButton = ({ onClick }: ISetNumberlineHandler) => (
//   <NumberlineButton
//     className="reset-button"
//     icon={<ResetIcon/>}
//     onClick={onClick}
//     tooltipOptions={{ title: "Reset"}}
//   />
// );


// export const DeleteButton = ({ onClick }: ISetNumberlineHandler) => (
//   <NumberlineButton
//     className="delete-button"
//     icon={<DeleteIcon/>}
//     onClick={onClick}
//     tooltipOptions={{ title: "Delete Point(s)"}}
//   />
// );




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
