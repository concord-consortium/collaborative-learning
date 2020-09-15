import { FunctionComponent, SVGProps } from "react";
// workspace icons
import CopyWorkspaceIcon from "../assets/icons/copy/copy-icon-default.svg";
import DeleteWorkspaceIcon from "../assets/icons/delete/delete-workspace-icon-default.svg";
import OpenWorkspaceIcon from "../assets/icons/1-4-up/1-up-icon-default.svg";
// tool icons
import DeleteToolIcon from "./assets/icons/delete-tool.svg";
import DrawingToolIcon from "./assets/icons/draw-tool.svg";
import GeometryToolIcon from "./assets/icons/graph-tool.svg";
import ImageToolIcon from "./assets/icons/image-tool.svg";
import RedoToolIcon from "./assets/icons/redo-tool.svg";
import SelectToolIcon from "./assets/icons/select-tool.svg";
import TableToolIcon from "./assets/icons/table-tool.svg";
import TextToolIcon from "./assets/icons/text-tool.svg";
import UndoToolIcon from "./assets/icons/undo-tool.svg";

export const appIcons: Record<string, FunctionComponent<SVGProps<SVGSVGElement>>> = {
  // workspace icons
  "icon-copy-workspace": CopyWorkspaceIcon,
  "icon-delete-workspace": DeleteWorkspaceIcon,
  "icon-new-workspace": OpenWorkspaceIcon,
  "icon-open-workspace": OpenWorkspaceIcon,
  // tool icons
  "icon-delete-tool": DeleteToolIcon,
  "icon-drawing-tool": DrawingToolIcon,
  "icon-geometry-tool": GeometryToolIcon,
  "icon-image-tool": ImageToolIcon,
  "icon-redo-tool": RedoToolIcon,
  "icon-select-tool": SelectToolIcon,
  "icon-table-tool": TableToolIcon,
  "icon-text-tool": TextToolIcon,
  "icon-undo-tool": UndoToolIcon
};
