import { ToolTileModelType } from "../../../models/tools/tool-tile";
import { IToolApiInterface } from "../tool-tile";

export interface SizeMeProps {
  size?: {
    width: number | null;
    height: number | null;
  };
}

export interface IToolButtonHandlers {
  handleDuplicate: () => void;
  handleToggleVertexAngle: () => void;
  handleCreateMovableLine: () => void;
  handleDelete: () => void;
  handleCreateComment: () => void;
}

export interface IGeometryProps extends SizeMeProps {
  context: string;
  scale?: number;
  tabIndex?: number;
  model: ToolTileModelType;
  readOnly?: boolean;
  toolApiInterface?: IToolApiInterface;
  onSetCanAcceptDrop: (tileId?: string) => void;
}
