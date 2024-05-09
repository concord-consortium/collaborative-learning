import React from "react";
import { observer } from "mobx-react";
import { IToolbarButtonComponentProps, registerTileToolbarButtons } from "../../toolbar/toolbar-button-manager";
import { TileToolbarButton } from "../../toolbar/tile-toolbar-button";
import { isPoint } from "../../../models/tiles/geometry/jxg-types";
import { useGeometryTileContext } from "./geometry-tile-context";
import { canSupportVertexAngle, getVertexAngle } from "../../../models/tiles/geometry/jxg-vertex-angle";
import { UploadButton } from "../../toolbar/upload-button";
import { useProviderTileLinking } from "../../../hooks/use-provider-tile-linking";
import { useReadOnlyContext } from "../../document/read-only-context";
import { useTileModelContext } from "../hooks/use-tile-model-context";

import AngleLabelSvg from "../../../clue/assets/icons/geometry/angle-label.svg";
import AddImageSvg from "../../../clue/assets/icons/geometry/add-image-icon.svg";
import CommentSvg from "../../../assets/icons/comment/comment.svg";
import DeleteSvg from "../../../assets/icons/delete/delete-selection-icon.svg";
import LineLabelSvg from "../../../clue/assets/icons/geometry/line-label.svg";
import MovableLineSvg from "../../../clue/assets/icons/geometry/movable-line.svg";
import PointSvg from "../../../clue/assets/icons/geometry/point-icon.svg";
import ShapesDuplicateSvg from "../../../clue/assets/icons/geometry/shapes-duplicate-icon.svg";
import AddDataSvg from "../../../assets/icons/add-data-graph-icon.svg";

const PointButton = observer(function PointButton({name}: IToolbarButtonComponentProps) {
  const { mode, setMode } = useGeometryTileContext();

  function onClick() {
    setMode(mode === "points" ? "select" : "points");
  }

  return (
    <TileToolbarButton
      name={name}
      title="Point"
      selected={mode === "points"}
      onClick={onClick}
    >
      <PointSvg/>
    </TileToolbarButton>
  );

});

const DuplicateButton = observer(function DuplicateButton({name}: IToolbarButtonComponentProps) {
  const { content, board, handlers } = useGeometryTileContext();
  const disableDuplicate = board && (!content?.getOneSelectedPoint(board) &&
    !content?.getOneSelectedPolygon(board));

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

const AngleLabelButton = observer(function AngleLabelButton({name}: IToolbarButtonComponentProps) {
  const { content, board, handlers } = useGeometryTileContext();
  const selectedObjects = board && content?.selectedObjects(board);
  const selectedPoints = selectedObjects?.filter(isPoint);
  const selectedPoint = selectedPoints?.length === 1 ? selectedPoints[0] : undefined;
  const disableVertexAngle = !(selectedPoint && canSupportVertexAngle(selectedPoint));
  // FIXME toggling this doesn't trigger the "observer" and thus doesn't change the selected state
  const hasVertexAngle = !!selectedPoint && !!getVertexAngle(selectedPoint);

  return (
    <TileToolbarButton
      name={name}
      title="Angle label"
      disabled={disableVertexAngle}
      selected={hasVertexAngle}
      onClick={() => handlers?.handleToggleVertexAngle()}
    >
      <AngleLabelSvg/>
    </TileToolbarButton>
  );
});

const LineLabelButton = observer(function LineLabelButton({name}: IToolbarButtonComponentProps) {
  const { content, board, handlers } = useGeometryTileContext();
  const disableLineLabel = board && !content?.getOneSelectedSegment(board);

  return (
    <TileToolbarButton
      name={name}
      title="Segment label"
      disabled={disableLineLabel}
      onClick={() => handlers?.handleCreateLineLabel()}
    >
      <LineLabelSvg/>
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
  const disableDelete = board && !content?.getDeletableSelectedIds(board).length;

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

registerTileToolbarButtons("geometry",
  [
    {
      name: "point",
      component: PointButton
    },
    {
      name: "duplicate",
      component: DuplicateButton
    },
    {
      name: "angle-label",
      component: AngleLabelButton
    },
    {
      name: "line-label",
      component: LineLabelButton
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
    }
  ]
);
