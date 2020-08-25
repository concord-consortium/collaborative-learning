import { IToolTileProps } from "../tool-tile";
import { HotKeyHandler } from "../../../utilities/hot-keys";

export interface IActionHandlers {
  handleArrows: HotKeyHandler;
  handleCut: () => void;
  handleCopy: () => void;
  handlePaste: () => void;
  handleDuplicate: () => void;
  handleDelete: () => void;
  handleUndo: () => void;
  handleRedo: () => void;
  handleToggleVertexAngle: () => void;
  handleCreateMovableLine: () => void;
  handleCreateComment: () => void;
}

export type IGeometryProps = IToolTileProps;
