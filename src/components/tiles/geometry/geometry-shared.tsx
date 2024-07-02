import { ITileProps } from "../tile-component";
import { HotKeyHandler } from "../../../utilities/hot-keys";

export interface IToolbarActionHandlers {
  handleDuplicate: () => void;
  handleDelete: () => void;
  handleToggleVertexAngle: () => void;
  handleCreateMovableLine: () => void;
  handleCreateLineLabel: () => void;
  handleCreateComment: () => void;
  handleUploadImageFile: (file: File) => void;
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  handleFitAll: () => void;
}
export interface IActionHandlers extends IToolbarActionHandlers {
  handleArrows: HotKeyHandler;
  handleCut: () => void;
  handleCopy: () => void;
  handlePaste: () => void;
}

export type IGeometryProps = ITileProps;
