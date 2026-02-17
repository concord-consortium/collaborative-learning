import { ITileProps } from "../tile-component";
import { HotKeyHandler } from "../../../utilities/hot-keys";

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
}
export interface IActionHandlers extends IToolbarActionHandlers {
  handleArrows: HotKeyHandler;
  handleCut: () => void;
  handleCopy: () => void;
  handlePaste: () => void;
}

export type IGeometryProps = ITileProps;
