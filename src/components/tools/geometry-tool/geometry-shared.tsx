import { IToolTileProps } from "../tool-tile";
import { HotKeyHandler } from "../../../utilities/hot-keys";

export interface IToolbarActionHandlers {
  handleDuplicate: () => void;
  handleDelete: () => void;
  handleToggleVertexAngle: () => void;
  handleCreateMovableLine: () => void;
  handleCreateComment: () => void;
}
export interface IActionHandlers extends IToolbarActionHandlers {
  handleArrows: HotKeyHandler;
  handleCut: () => void;
  handleCopy: () => void;
  handlePaste: () => void;
  handleUndo: () => void;
  handleRedo: () => void;
}

export type IGeometryProps = IToolTileProps;
