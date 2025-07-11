import React, { FunctionComponent, SVGProps } from "react";
import { observer } from "mobx-react";
import { IToolbarButtonComponentProps, registerTileToolbarButtons } from "../../toolbar/toolbar-button-manager";
import { TileToolbarButton } from "../../toolbar/tile-toolbar-button";
import { useGeometryTileContext } from "./geometry-tile-context";
import { UploadButton } from "../../toolbar/upload-button";
import { useProviderTileLinking } from "../../../hooks/use-provider-tile-linking";
import { useReadOnlyContext } from "../../document/read-only-context";
import { useTileModelContext } from "../hooks/use-tile-model-context";
import { GeometryTileMode } from "./geometry-types";
import { ColorPalette } from "./color-palette";
import { clueBasicDataColorInfo } from "../../../utilities/color-utils";
import { GeometryContentModelType } from "src/models/tiles/geometry/geometry-content";
import { NavigatorButton } from "../../toolbar/navigator-button";
import { logGeometryEvent } from "../../../models/tiles/geometry/geometry-utils";

import AddImageSvg from "../../../clue/assets/icons/geometry/add-image-icon.svg";
import CommentSvg from "../../../assets/icons/comment/comment.svg";
import DeleteSvg from "../../../assets/icons/delete/delete-selection-icon.svg";
import LabelSvg from "../../../clue/assets/icons/shapes-label-value-icon.svg";
import MovableLineSvg from "../../../clue/assets/icons/geometry/movable-line.svg";
import PointSvg from "../../../clue/assets/icons/geometry/point-icon.svg";
import PolygonSvg from "../../../clue/assets/icons/geometry/polygon-icon.svg";
import CircleSvg from "../../../clue/assets/icons/geometry/circle-icon.svg";
import SelectSvg from "../../../clue/assets/icons/select-tool.svg";
import ShapesColorIcon from "../../../clue/assets/icons/geometry/shapes-color-icon.svg";
import ShapesDuplicateSvg from "../../../clue/assets/icons/geometry/shapes-duplicate-icon.svg";
import AddDataSvg from "../../../assets/icons/add-data-graph-icon.svg";
import ZoomInSvg from "../../../clue/assets/icons/zoom-in-icon.svg";
import ZoomOutSvg from "../../../clue/assets/icons/zoom-out-icon.svg";
import FitAllSvg from "../../../clue/assets/icons/fit-view-icon.svg";

import "./geometry-toolbar.scss";

function getColorClass (content: GeometryContentModelType | undefined) {
  return content?.selectedColor ? clueBasicDataColorInfo[content.selectedColor].name : undefined;
}

function ModeButton({name, title, targetMode, Icon, colorClass}:
  { name: string, title: string, targetMode: GeometryTileMode,
    Icon: FunctionComponent<SVGProps<SVGSVGElement>>, colorClass?: string }) {
  const { board, content, mode, setMode } = useGeometryTileContext();

  function onClick() {
    if (mode !== targetMode) {
      setMode(targetMode);
      if (board) {
        content?.clearPhantomPoint(board);
        content?.clearActivePolygon(board);
      }
    }
  }

  return (
    <TileToolbarButton
      name={name}
      title={title}
      selected={mode === targetMode}
      onClick={onClick}
      colorClass={colorClass || ""}
    >
      <Icon />
    </TileToolbarButton>
  );
}

const SelectButton = observer(function SelectButton({name}: IToolbarButtonComponentProps) {
  return(<ModeButton name={name} title="Select" targetMode="select" Icon={SelectSvg} />);
});

const PointButton = observer(function PointButton({name}: IToolbarButtonComponentProps) {
  const { content } = useGeometryTileContext();
  const colorClass = getColorClass(content);
  return(<ModeButton name={name} title="Point" targetMode="points" Icon={PointSvg} colorClass={colorClass} />);
});

const PolygonButton = observer(function PolygonButton({name}: IToolbarButtonComponentProps) {
  const { content } = useGeometryTileContext();
  const colorClass = getColorClass(content);
  return(<ModeButton name={name} title="Polygon" targetMode="polygon" Icon={PolygonSvg} colorClass={colorClass}/>);
});

const ColorChangeButton = observer(function ColorChangeButton({name}: IToolbarButtonComponentProps) {
  const { content, handlers } = useGeometryTileContext();
  const colorClass = getColorClass(content);


  const handleClick = () => {
    handlers?.handleSetShowColorPalette(!content?.showColorPalette);
  };

  return (
    <TileToolbarButton
      name={name}
      title="Color"
      onClick={handleClick}
      colorClass={colorClass}
    >
      <ShapesColorIcon/>
      {content?.showColorPalette &&
        <div>
         <ColorPalette
          selectedColor={content?.selectedColor}
          onSelectColor={(color) => handlers?.handleColorChange(color)}
         />
        </div>
      }
    </TileToolbarButton>
  );
});

const CircleButton = observer(function CircleButton({name}: IToolbarButtonComponentProps) {
  const { content } = useGeometryTileContext();
  const colorClass = clueBasicDataColorInfo[content?.selectedColor || 0].name;
  return(<ModeButton name={name} title="Circle" targetMode="circle" Icon={CircleSvg} colorClass={colorClass}/>);
});

const DuplicateButton = observer(function DuplicateButton({name}: IToolbarButtonComponentProps) {
  const { content, board, handlers } = useGeometryTileContext();
  const disableDuplicate = !content || !board || !content.hasDeletableSelection(board);
  return (
    <TileToolbarButton
      name={name}
      title="Duplicate"
      disabled={disableDuplicate}
      onClick={() => handlers?.handleDuplicate()}
    >
      <ShapesDuplicateSvg/>
    </TileToolbarButton>
  );

});

const LabelButton = observer(function LabelButton({name}: IToolbarButtonComponentProps) {
  const { content, board, handlers } = useGeometryTileContext();
  const selectedPoint = board && content?.getOneSelectedPoint(board);
  const selectedSegment = board && content?.getOneSelectedSegment(board);
  const selectedPolygon = board && content?.getOneSelectedPolygon(board);

  const pointHasLabel = selectedPoint && selectedPoint.hasLabel;
  const segmentHasLabel = selectedSegment && selectedSegment.hasLabel;
  const polygonHasLabel = selectedPolygon && selectedPolygon.hasLabel;

  function handleClick() {
    handlers?.handleLabelDialog(selectedPoint, selectedSegment, selectedPolygon);
  }

  return (
    <TileToolbarButton
      name={name}
      title="Label/Value"
      disabled={!selectedPoint && !selectedSegment && !selectedPolygon}
      selected={pointHasLabel || segmentHasLabel || polygonHasLabel}
      onClick={handleClick}
    >
      <LabelSvg/>
    </TileToolbarButton>
  );

});

const MovableLineButton = observer(function MovableLineButton({name}: IToolbarButtonComponentProps) {
  const { handlers } = useGeometryTileContext();
  return (
    <TileToolbarButton
      name={name}
      title="Movable line"
      onClick={() => handlers?.handleCreateMovableLine()}
    >
      <MovableLineSvg/>
    </TileToolbarButton>
  );
});

const CommentButton = observer(function CommentButton({name}: IToolbarButtonComponentProps) {
  const { content, board, handlers } = useGeometryTileContext();
  const disableComment = board && !content?.getCommentAnchor(board) && !content?.getOneSelectedComment(board);

  return (
    <TileToolbarButton
      name={name}
      title="Comment"
      disabled={disableComment}
      onClick={() => handlers?.handleCreateComment()}
    >
      <CommentSvg/>
    </TileToolbarButton>
  );
});

const DeleteButton = observer(function DeleteButton({name}: IToolbarButtonComponentProps) {
  const { content, board, handlers } = useGeometryTileContext();
  const disableDelete = !board || !content?.hasDeletableSelection(board);

  return (
    <TileToolbarButton
      name={name}
      title="Delete"
      disabled={disableDelete}
      onClick={() => handlers?.handleDelete()}
    >
      <DeleteSvg/>
    </TileToolbarButton>
  );
});

const ImageUploadButton = observer(function ImageUploadButton({name}: IToolbarButtonComponentProps) {
  const { handlers } = useGeometryTileContext();

  const onUploadImageFile = (x: File) => {
    handlers?.handleUploadImageFile(x);
  };

  return (
    <UploadButton
      name={name}
      title="Upload image"
      onUpload={onUploadImageFile}
      accept="image/png, image/jpeg"
      >
      <AddImageSvg/>
    </UploadButton>
  );
});

const AddDataButton = observer (function AddDataButton({name}: IToolbarButtonComponentProps) {
  const readOnly = useReadOnlyContext();
  const { tile } = useTileModelContext();
  const { isLinkEnabled, showLinkTileDialog }
    = useProviderTileLinking({ model: tile!, readOnly, sharedModelTypes: [ "SharedDataSet" ] });
  return (
    <TileToolbarButton
      name={name}
      title="Add data"
      disabled={!isLinkEnabled}
      onClick={showLinkTileDialog}
      >
      <AddDataSvg/>
    </TileToolbarButton>
  );
});

function ZoomInButton({name}: IToolbarButtonComponentProps) {
  const readOnly = useReadOnlyContext();
  const { handlers } = useGeometryTileContext();

  function handleClick() {
    if (readOnly) return;
    handlers?.handleZoomIn();
  }

  return (
    <TileToolbarButton
      name={name}
      title="Zoom In"
      onClick={handleClick}
      >
      <ZoomInSvg/>
    </TileToolbarButton>
  );
}

function ZoomOutButton({name}: IToolbarButtonComponentProps) {
  const readOnly = useReadOnlyContext();
  const { handlers } = useGeometryTileContext();

  function handleClick() {
    if (readOnly) return;
    handlers?.handleZoomOut();
  }

  return (
    <TileToolbarButton
      name={name}
      title="Zoom Out"
      onClick={handleClick}
      >
      <ZoomOutSvg/>
    </TileToolbarButton>
  );
}

const FitAllButton = observer(function FitAllButton({name}: IToolbarButtonComponentProps) {
  const readOnly = useReadOnlyContext();
  const { content, handlers } = useGeometryTileContext();
  const disabled = !content || content.objects.size === 0;

  function handleClick() {
    if (readOnly) return;
    handlers?.handleFitAll();
  }

  return (
    <TileToolbarButton
      name={name}
      title="Fit all"
      onClick={handleClick}
      disabled={disabled}
    >
      <FitAllSvg/>
    </TileToolbarButton>
  );
});

const GeometryNavigatorButton = ({name}: IToolbarButtonComponentProps) => {
  const { content } = useGeometryTileContext();
  const logChange = (visible: boolean) => {
    if (!content) return;
    logGeometryEvent(content, visible ? "showNavigator" : "hideNavigator", "board");
  };
  return (<NavigatorButton name={name} onChange={logChange} />);
};

registerTileToolbarButtons("geometry",
  [
    { name: "select",
      component: SelectButton
    },
    {
      name: "point",
      component: PointButton
    },
    {
      name: "polygon",
      component: PolygonButton
    },
    {
      name: "color",
      component: ColorChangeButton
    },
    {
      name: "circle",
      component: CircleButton
    },
    {
      name: "duplicate",
      component: DuplicateButton
    },
    {
      name: "label",
      component: LabelButton
    },
    {
      name: "movable-line",
      component: MovableLineButton
    },
    {
      name: "comment",
      component: CommentButton
    },
    {
      name: "upload",
      component: ImageUploadButton
    },
    {
      name: "add-data",
      component: AddDataButton
    },
    {
      name: "delete",
      component: DeleteButton
    },
    {
      name: "zoom-in",
      component: ZoomInButton
    },
    {
      name: "zoom-out",
      component: ZoomOutButton
    },
    {
      name: "fit-all",
      component: FitAllButton
    },
    {
      name: "navigator",
      component: GeometryNavigatorButton
    },
  ]
);
