import { ITileProps } from "../tile-component";
import { HotKeyHandler } from "../../../utilities/hot-keys";
import { GeometryTileMode } from "./geometry-types";

export interface IToolbarActionHandlers {
  handleDuplicate: () => void;
  handleDelete: () => void;
  handleLabelDialog: (selectedPoint: JXG.Point|undefined, selectedSegment: JXG.Line|undefined,
    selectedPolygon: JXG.Polygon|undefined, selectedLine: JXG.Line|undefined ) => void;
  handleCreateMovableLine: () => void;
  handleCreateComment: () => void;
  handleUploadImageFile: (file: File) => void;
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  handleFitAll: () => void;
  handleSetShowColorPalette: (showColorPalette: boolean) => void;
  handleColorChange: (color: number) => void;
  /** Keyboard/SR activation of a mode button seeds a unit-sized shape at (1, 1). */
  handleSeedShape: (mode: GeometryTileMode) => void;
}
export interface IActionHandlers extends IToolbarActionHandlers {
  handleArrows: HotKeyHandler;
  handleCut: () => void;
  handleCopy: () => void;
  handlePaste: () => void;
}

export type IGeometryProps = ITileProps;
