import { SizeMeProps } from "react-sizeme";
import { ToolTileModelType } from "../../../models/tools/tool-tile";
import { IToolApiInterface } from "../tool-tile";
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

export interface IGeometryProps extends SizeMeProps {
  context: string;
  scale?: number;
  model: ToolTileModelType;
  readOnly?: boolean;
  toolApiInterface?: IToolApiInterface;
  onSetCanAcceptDrop: (tileId?: string) => void;
  onRequestRowHeight: (tileId: string, height: number) => void;
}
